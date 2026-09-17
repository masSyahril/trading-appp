<?php
declare(strict_types=1);

/**
 * The actual reconciliation logic that used to live entirely inside
 * api/orders/check-fills.php, extracted so it can run two ways:
 *
 *  1. Per-request, for whichever single user is polling (api/orders/
 *     check-fills.php - still called by pages/auth/order-authority.js
 *     while that user has a stock-market tab open, for a fast/responsive
 *     fill).
 *  2. For EVERY user with outstanding working orders or sl/tp positions,
 *     in one batch, from api/jobs/run-check-fills.php - a background job
 *     meant to be run on a short interval (e.g. Windows Task Scheduler
 *     calling `php run-check-fills.php` every minute) so a stop-loss or
 *     limit order still fires even if nobody has a browser tab open. This
 *     was flagged as a known gap in docs/SETUP_AUTH.md ("no background
 *     cron in this stack") - this file plus the job script closes it.
 *
 * Both callers must run this inside their own transaction and have already
 * fetched $uid's row lock context appropriately; this function does the
 * FOR UPDATE locking itself, so callers just need to be inside a
 * transaction when they call it.
 */

/**
 * @return array{filled: string[], closed: array, pnlTotal: float}
 */
function tl_reconcile_user_fills(PDO $pdo, int $uid): array {
    // Normally api/state/seed.php (stock) has already created this
    // account's portfolio_accounts row - this is just a defensive fallback
    // so a working order that fills/closes this round still has a balance
    // row to update.
    $ensureAcct = $pdo->prepare('SELECT 1 FROM portfolio_accounts WHERE user_id = :uid');
    $ensureAcct->execute([':uid' => $uid]);
    if ($ensureAcct->fetch() === false) {
        try {
            $pdo->prepare('INSERT INTO portfolio_accounts (user_id, balance) VALUES (:uid, 100000.00)')
                ->execute([':uid' => $uid]);
        } catch (PDOException $e) {
            // Lost a race with a concurrent request creating the same row - fine either way.
        }
    }

    $ordersStmt = $pdo->prepare('SELECT * FROM working_orders WHERE user_id = :uid FOR UPDATE');
    $ordersStmt->execute([':uid' => $uid]);
    $workingOrders = $ordersStmt->fetchAll();

    $positionsStmt = $pdo->prepare(
        "SELECT * FROM positions WHERE user_id = :uid AND (sl IS NOT NULL OR tp IS NOT NULL) FOR UPDATE"
    );
    $positionsStmt->execute([':uid' => $uid]);
    $watchedPositions = $positionsStmt->fetchAll();

    $symbols = [];
    foreach ($workingOrders as $o) { $symbols[$o['symbol']] = true; }
    foreach ($watchedPositions as $p) { $symbols[$p['symbol']] = true; }

    $quotes = [];
    foreach (array_keys($symbols) as $symbol) {
        try {
            $quotes[$symbol] = tl_fetch_latest_price($symbol)['last'];
        } catch (TlQuoteUnavailableException $e) {
            error_log('order_engine: no quote for ' . $symbol . ' (uid ' . $uid . '): ' . $e->getMessage());
        }
    }

    $filled = [];
    $closed = [];
    $pnlTotal = 0.0;
    $now = gmdate('Y-m-d H:i:s');

    $toEvaluateForStops = $watchedPositions;

    foreach ($workingOrders as $order) {
        $price = $quotes[$order['symbol']] ?? null;
        if ($price === null) {
            continue;
        }
        $triggered = $order['type'] === 'limit'
            ? ($order['side'] === 'buy' ? $price <= (float) $order['price'] : $price >= (float) $order['price'])
            : ($order['side'] === 'buy' ? $price >= (float) $order['price'] : $price <= (float) $order['price']);

        if (!$triggered) {
            continue;
        }

        $pdo->prepare('DELETE FROM working_orders WHERE user_id = :uid AND client_id = :cid')
            ->execute([':uid' => $uid, ':cid' => $order['client_id']]);

        $asPosition = [
            'client_id' => $order['client_id'],
            'symbol' => $order['symbol'],
            'side' => $order['side'],
            'size' => $order['size'],
            'leverage' => $order['leverage'],
            'entry_price' => $price,
            'sl' => $order['sl'],
            'tp' => $order['tp'],
            'opened_at' => $now,
        ];
        $filled[] = $order['client_id'];

        tl_log_fill_event($pdo, [
            'user_id' => $uid, 'market' => 'stock', 'symbol' => $order['symbol'], 'side' => $order['side'],
            'reason' => $order['type'] === 'limit' ? 'limit_fill' : 'stop_fill',
            'qty' => (float) $order['size'], 'price' => $price, 'client_id' => $order['client_id'], 'created_at' => $now,
        ]);

        if ($asPosition['sl'] !== null || $asPosition['tp'] !== null) {
            $toEvaluateForStops[] = $asPosition;
        } else {
            tl_insert_position($pdo, $uid, $asPosition);
        }
    }

    foreach ($toEvaluateForStops as $pos) {
        $price = $quotes[$pos['symbol']] ?? null;
        $isFreshFill = in_array($pos['client_id'], $filled, true);

        if ($price === null) {
            if ($isFreshFill) {
                tl_insert_position($pdo, $uid, $pos);
            }
            continue;
        }

        $isLong = $pos['side'] !== 'sell';
        $sl = $pos['sl'] !== null ? (float) $pos['sl'] : null;
        $tp = $pos['tp'] !== null ? (float) $pos['tp'] : null;
        $hitSl = $sl !== null && ($isLong ? $price <= $sl : $price >= $sl);
        $hitTp = $tp !== null && ($isLong ? $price >= $tp : $price <= $tp);

        if (!$hitSl && !$hitTp) {
            if ($isFreshFill) {
                tl_insert_position($pdo, $uid, $pos);
            }
            continue;
        }

        if (!$isFreshFill) {
            $pdo->prepare('DELETE FROM positions WHERE user_id = :uid AND client_id = :cid')
                ->execute([':uid' => $uid, ':cid' => $pos['client_id']]);
        }

        $entryPrice = (float) $pos['entry_price'];
        $size = (float) $pos['size'];
        $sign = $pos['side'] === 'sell' ? -1 : 1;
        $pnl = ($price - $entryPrice) * $size * $sign;
        $pnlTotal += $pnl;

        $pdo->prepare(
            'INSERT INTO trade_history (user_id, client_id, symbol, side, size, leverage, entry_price, exit_price, sl, tp, pnl, opened_at, closed_at)
             VALUES (:uid, :cid, :symbol, :side, :size, :leverage, :entry_price, :exit_price, :sl, :tp, :pnl, :opened_at, :closed_at)'
        )->execute([
            ':uid' => $uid, ':cid' => $pos['client_id'], ':symbol' => $pos['symbol'], ':side' => $pos['side'],
            ':size' => $size, ':leverage' => $pos['leverage'], ':entry_price' => $entryPrice, ':exit_price' => $price,
            ':sl' => $pos['sl'], ':tp' => $pos['tp'], ':pnl' => $pnl, ':opened_at' => $pos['opened_at'], ':closed_at' => $now,
        ]);

        $reason = $hitSl ? 'Stop-loss hit' : 'Take-profit hit';
        tl_log_fill_event($pdo, [
            'user_id' => $uid, 'market' => 'stock', 'symbol' => $pos['symbol'], 'side' => $pos['side'],
            'reason' => $hitSl ? 'sl_hit' : 'tp_hit', 'qty' => $size, 'price' => $price,
            'pnl_delta' => $pnl, 'client_id' => $pos['client_id'], 'created_at' => $now,
        ]);

        $closed[] = ['clientId' => $pos['client_id'], 'reason' => $reason, 'exitPrice' => $price, 'pnl' => $pnl];
    }

    if ($pnlTotal !== 0.0) {
        $acctStmt = $pdo->prepare('SELECT balance FROM portfolio_accounts WHERE user_id = :uid FOR UPDATE');
        $acctStmt->execute([':uid' => $uid]);
        $acctRow = $acctStmt->fetch();
        if ($acctRow === false) {
            $pdo->prepare('INSERT INTO portfolio_accounts (user_id, balance) VALUES (:uid, :balance)')
                ->execute([':uid' => $uid, ':balance' => 100000.00 + $pnlTotal]);
        } else {
            $pdo->prepare('UPDATE portfolio_accounts SET balance = :balance WHERE user_id = :uid')
                ->execute([':uid' => $uid, ':balance' => (float) $acctRow['balance'] + $pnlTotal]);
        }
    }

    return ['filled' => $filled, 'closed' => $closed, 'pnlTotal' => $pnlTotal];
}

function tl_insert_position(PDO $pdo, int $uid, array $pos): void {
    $pdo->prepare(
        'INSERT INTO positions (user_id, client_id, symbol, side, size, leverage, entry_price, sl, tp, opened_at)
         VALUES (:uid, :cid, :symbol, :side, :size, :leverage, :entry_price, :sl, :tp, :opened_at)'
    )->execute([
        ':uid' => $uid, ':cid' => $pos['client_id'], ':symbol' => $pos['symbol'], ':side' => $pos['side'],
        ':size' => $pos['size'], ':leverage' => $pos['leverage'], ':entry_price' => $pos['entry_price'],
        ':sl' => $pos['sl'], ':tp' => $pos['tp'], ':opened_at' => $pos['opened_at'],
    ]);
}

/**
 * Every distinct user_id with something this engine could act on right now
 * - used only by api/jobs/run-check-fills.php to know which accounts to
 * process in a batch run (the HTTP endpoint already knows its own $uid from
 * the session).
 *
 * @return int[]
 */
function tl_users_with_pending_orders(PDO $pdo): array {
    $rows = $pdo->query(
        'SELECT user_id FROM working_orders
         UNION
         SELECT user_id FROM positions WHERE sl IS NOT NULL OR tp IS NOT NULL'
    )->fetchAll();
    return array_map(fn($r) => (int) $r['user_id'], $rows);
}
