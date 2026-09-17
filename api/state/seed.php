<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

/*
 * One-time import of a brand-new account's pre-existing local
 * paper-trading snapshot (balance/positions/workingOrders/history/
 * watchlist), verbatim, exactly as api/state/save.php used to do on every
 * sync tick. This is the one remaining place a client's numbers are
 * trusted wholesale - deliberately, because a brand-new account has
 * nothing authoritative yet to protect (there's no way to "cheat" a
 * balance that doesn't exist yet), and closing it lets someone who's been
 * paper-trading anonymously in this browser keep that history when they
 * sign up instead of losing it.
 *
 * Guarded so it can only ever run once per account: if portfolio_accounts
 * already has a row for this user, every subsequent call is a no-op
 * (whether that row was created by an earlier seed or by a normal
 * api/orders/*.php fill/close). This closes the loophole the old save.php
 * had, where the exact same "no server data yet" path could in principle
 * be hit again and again.
 */

tl_require_method('POST');
tl_check_same_origin();

$user = tl_require_auth();
$body = tl_read_json_body();
$uid = $user['id'];

$pdo = tl_db();

$exists = $pdo->prepare('SELECT 1 FROM portfolio_accounts WHERE user_id = :uid');
$exists->execute([':uid' => $uid]);
if ($exists->fetch() !== false) {
    tl_json(['ok' => true, 'seeded' => false, 'reason' => 'already seeded']);
}

try {
    $data = tl_validate_portfolio_payload($body);
} catch (InvalidArgumentException $e) {
    tl_error($e->getMessage(), 400);
}

$pdo->beginTransaction();
try {
    // INSERT, not upsert - if a concurrent request already created this
    // row (two tabs opening at once), this one fails on the primary key
    // and the catch block below reports "already seeded" instead of
    // silently overwriting whatever the other request just wrote.
    $pdo->prepare('INSERT INTO portfolio_accounts (user_id, balance) VALUES (:uid, :balance)')
        ->execute([':uid' => $uid, ':balance' => $data['balance']]);

    if (count($data['positions']) > 0) {
        $insertPosition = $pdo->prepare(
            'INSERT INTO positions (user_id, client_id, symbol, side, size, leverage, entry_price, sl, tp, opened_at)
             VALUES (:uid, :client_id, :symbol, :side, :size, :leverage, :entry_price, :sl, :tp, :opened_at)'
        );
        $seen = [];
        foreach ($data['positions'] as $p) {
            if (isset($seen[$p['client_id']])) {
                continue;
            }
            $seen[$p['client_id']] = true;
            $insertPosition->execute([
                ':uid' => $uid,
                ':client_id' => $p['client_id'],
                ':symbol' => $p['symbol'],
                ':side' => $p['side'],
                ':size' => $p['size'],
                ':leverage' => $p['leverage'],
                ':entry_price' => $p['entry_price'],
                ':sl' => $p['sl'],
                ':tp' => $p['tp'],
                ':opened_at' => $p['opened_at'],
            ]);
        }
    }

    if (count($data['orders']) > 0) {
        $insertOrder = $pdo->prepare(
            'INSERT INTO working_orders (user_id, client_id, symbol, side, type, size, price, leverage, sl, tp, created_at)
             VALUES (:uid, :client_id, :symbol, :side, :type, :size, :price, :leverage, :sl, :tp, :created_at)'
        );
        $seen = [];
        foreach ($data['orders'] as $o) {
            if (isset($seen[$o['client_id']])) {
                continue;
            }
            $seen[$o['client_id']] = true;
            $insertOrder->execute([
                ':uid' => $uid,
                ':client_id' => $o['client_id'],
                ':symbol' => $o['symbol'],
                ':side' => $o['side'],
                ':type' => $o['type'],
                ':size' => $o['size'],
                ':price' => $o['price'],
                ':leverage' => $o['leverage'],
                ':sl' => $o['sl'],
                ':tp' => $o['tp'],
                ':created_at' => $o['created_at'],
            ]);
        }
    }

    if (count($data['history']) > 0) {
        $insertHistory = $pdo->prepare(
            'INSERT INTO trade_history (user_id, client_id, symbol, side, size, leverage, entry_price, exit_price, sl, tp, pnl, opened_at, closed_at)
             VALUES (:uid, :client_id, :symbol, :side, :size, :leverage, :entry_price, :exit_price, :sl, :tp, :pnl, :opened_at, :closed_at)'
        );
        foreach ($data['history'] as $h) {
            $insertHistory->execute([
                ':uid' => $uid,
                ':client_id' => $h['client_id'],
                ':symbol' => $h['symbol'],
                ':side' => $h['side'],
                ':size' => $h['size'],
                ':leverage' => $h['leverage'],
                ':entry_price' => $h['entry_price'],
                ':exit_price' => $h['exit_price'],
                ':sl' => $h['sl'],
                ':tp' => $h['tp'],
                ':pnl' => $h['pnl'],
                ':opened_at' => $h['opened_at'],
                ':closed_at' => $h['closed_at'],
            ]);
        }
    }

    if ($data['watchlist'] !== null && count($data['watchlist']) > 0) {
        $insertWatch = $pdo->prepare(
            'INSERT INTO watchlist_items (user_id, symbol, sort_order) VALUES (:uid, :symbol, :sort_order)'
        );
        foreach (array_values($data['watchlist']) as $i => $symbol) {
            $insertWatch->execute([':uid' => $uid, ':symbol' => $symbol, ':sort_order' => $i]);
        }
    }

    if ($data['alerts'] !== null && count($data['alerts']) > 0) {
        $insertAlert = $pdo->prepare(
            'INSERT INTO price_alerts (user_id, alert_id, symbol, price) VALUES (:uid, :alert_id, :symbol, :price)'
        );
        foreach ($data['alerts'] as $a) {
            $insertAlert->execute([':uid' => $uid, ':alert_id' => $a['id'], ':symbol' => $a['symbol'], ':price' => $a['price']]);
        }
    }

    $pdo->commit();
} catch (PDOException $e) {
    $pdo->rollBack();
    // Most likely a duplicate-key race on portfolio_accounts (another
    // request seeded this account a moment ago) - report the same
    // "already seeded" outcome rather than a 500.
    $exists->execute([':uid' => $uid]);
    if ($exists->fetch() !== false) {
        tl_json(['ok' => true, 'seeded' => false, 'reason' => 'already seeded']);
    }
    error_log('state/seed failed: ' . $e->getMessage());
    tl_error('Could not import your portfolio. Please try again.', 500);
}

tl_json(['ok' => true, 'seeded' => true]);
