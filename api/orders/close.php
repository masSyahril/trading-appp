<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

/*
 * Server-authoritative position close: fetches a live price itself and
 * uses that for exitPrice/pnl - a request that also includes an
 * "exitPrice" or "pnl" field just has those fields ignored, same as
 * api/orders/place.php ignores a client-sent entry price for market
 * orders. Scoped to $uid everywhere, so one account can never close
 * another's position even with a guessed/leaked client_id.
 */

const TL_DEFAULT_STARTING_BALANCE = 100000.00;

tl_require_method('POST');
tl_check_same_origin();

$user = tl_require_auth();
$body = tl_read_json_body();
$uid = $user['id'];

try {
    $clientId = tl_expect_string($body['id'] ?? null, 'id', 40);
    $reason = isset($body['reason']) && is_string($body['reason']) ? substr($body['reason'], 0, 60) : 'Closed';
} catch (InvalidArgumentException $e) {
    tl_error($e->getMessage(), 400);
}

$pdo = tl_db();

$posStmt = $pdo->prepare('SELECT * FROM positions WHERE user_id = :uid AND client_id = :cid');
$posStmt->execute([':uid' => $uid, ':cid' => $clientId]);
$position = $posStmt->fetch();

if ($position === false) {
    // Either never existed, belongs to someone else, or was already closed
    // (e.g. the local UI's close button double-clicked, or check-fills.php
    // closed it via a stop/take-profit hit a moment earlier). Idempotent:
    // if it's sitting in this user's history already, report that success
    // rather than an error.
    $histStmt = $pdo->prepare(
        'SELECT * FROM trade_history WHERE user_id = :uid AND client_id = :cid ORDER BY closed_at DESC LIMIT 1'
    );
    $histStmt->execute([':uid' => $uid, ':cid' => $clientId]);
    if ($row = $histStmt->fetch()) {
        tl_json(['ok' => true, 'duplicate' => true, 'trade' => tl_history_row_to_client($row)]);
    }
    tl_error('Position not found.', 404);
}

try {
    $quote = tl_fetch_latest_price($position['symbol']);
} catch (TlQuoteUnavailableException $e) {
    tl_error('Could not get a live price for ' . $position['symbol'] . ' right now. Please try again.', 502);
}
$exitPrice = $quote['last'];

$entryPrice = (float) $position['entry_price'];
$size = (float) $position['size'];
$sign = $position['side'] === 'sell' ? -1 : 1;
$pnl = ($exitPrice - $entryPrice) * $size * $sign;
$closedAt = gmdate('Y-m-d H:i:s');

$pdo->beginTransaction();
try {
    // Row lock so a concurrent close/check-fills reconciliation for this
    // same user can't read a stale balance between this SELECT and the
    // UPDATE/INSERT below.
    $acctStmt = $pdo->prepare('SELECT balance FROM portfolio_accounts WHERE user_id = :uid FOR UPDATE');
    $acctStmt->execute([':uid' => $uid]);
    $acctRow = $acctStmt->fetch();

    if ($acctRow === false) {
        $newBalance = TL_DEFAULT_STARTING_BALANCE + $pnl;
        $pdo->prepare('INSERT INTO portfolio_accounts (user_id, balance) VALUES (:uid, :balance)')
            ->execute([':uid' => $uid, ':balance' => $newBalance]);
    } else {
        $newBalance = (float) $acctRow['balance'] + $pnl;
        $pdo->prepare('UPDATE portfolio_accounts SET balance = :balance WHERE user_id = :uid')
            ->execute([':uid' => $uid, ':balance' => $newBalance]);
    }

    $pdo->prepare('DELETE FROM positions WHERE user_id = :uid AND client_id = :cid')
        ->execute([':uid' => $uid, ':cid' => $clientId]);

    $pdo->prepare(
        'INSERT INTO trade_history (user_id, client_id, symbol, side, size, leverage, entry_price, exit_price, sl, tp, pnl, opened_at, closed_at)
         VALUES (:uid, :cid, :symbol, :side, :size, :leverage, :entry_price, :exit_price, :sl, :tp, :pnl, :opened_at, :closed_at)'
    )->execute([
        ':uid' => $uid,
        ':cid' => $clientId,
        ':symbol' => $position['symbol'],
        ':side' => $position['side'],
        ':size' => $size,
        ':leverage' => $position['leverage'],
        ':entry_price' => $entryPrice,
        ':exit_price' => $exitPrice,
        ':sl' => $position['sl'],
        ':tp' => $position['tp'],
        ':pnl' => $pnl,
        ':opened_at' => $position['opened_at'],
        ':closed_at' => $closedAt,
    ]);

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('orders/close failed: ' . $e->getMessage());
    tl_error('Could not close position. Please try again.', 500);
}

tl_log_fill_event($pdo, [
    'user_id' => $uid, 'market' => 'stock', 'symbol' => $position['symbol'], 'side' => $position['side'],
    'reason' => 'manual_close', 'qty' => $size, 'price' => $exitPrice, 'pnl_delta' => $pnl,
    'client_id' => $clientId, 'created_at' => $closedAt,
]);

tl_json([
    'ok' => true,
    'duplicate' => false,
    'exitPrice' => $exitPrice,
    'pnl' => $pnl,
    'balance' => $newBalance,
    'reason' => $reason,
]);
