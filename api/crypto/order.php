<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

/*
 * Server-authoritative crypto market order. Crypto trading only has market
 * buy/sell today (see crypto-trading/crypto-app.prod.js - no limit/stop,
 * no SL/TP, no leverage), so this is the crypto equivalent of
 * api/orders/place.php's market-order branch: the fill price comes from
 * tl_fetch_latest_crypto_price() here on the server, never from the
 * client, and the resulting position (qty/avg/realized) is computed
 * server-side too via the exact same netting math crypto-app.prod.js uses
 * locally (api/lib/crypto.php's tl_apply_crypto_fill) - so the number
 * a signed-in user sees is never something their own browser decided.
 *
 * Idempotent on (user_id, client_id), same pattern as api/orders/place.php.
 */

tl_require_method('POST');
tl_check_same_origin();

$user = tl_require_auth();
$body = tl_read_json_body();
$uid = $user['id'];

try {
    $clientId = tl_expect_client_id($body['clientId'] ?? null, 'clientId');
    $symbol = tl_expect_crypto_symbol($body['symbol'] ?? null, 'symbol');
    $side = tl_expect_side($body['side'] ?? null, 'side');
    $qty = tl_expect_number($body['qty'] ?? null, 'qty', 0.00000001, 1e12);
} catch (InvalidArgumentException $e) {
    tl_error($e->getMessage(), 400);
}

$pdo = tl_db();

// Idempotency check first, same as api/orders/place.php.
$existingOrder = $pdo->prepare('SELECT * FROM crypto_orders WHERE user_id = :uid AND client_id = :cid');
$existingOrder->execute([':uid' => $uid, ':cid' => $clientId]);
if ($row = $existingOrder->fetch()) {
    $posStmt = $pdo->prepare('SELECT * FROM crypto_positions WHERE user_id = :uid AND symbol = :symbol');
    $posStmt->execute([':uid' => $uid, ':symbol' => $row['symbol']]);
    $posRow = $posStmt->fetch();
    tl_json([
        'ok' => true,
        'duplicate' => true,
        'price' => (float) $row['price'],
        'order' => tl_crypto_order_row_to_client($row),
        'position' => $posRow ? tl_crypto_position_row_to_client($posRow) : ['qty' => 0.0, 'avg' => 0.0, 'realized' => 0.0],
    ]);
}

try {
    $quote = tl_fetch_latest_crypto_price($symbol);
} catch (TlQuoteUnavailableException $e) {
    tl_error('Could not get a live price for ' . $symbol . ' right now. Please try again.', 502);
}
$price = $quote['last'];
$now = gmdate('Y-m-d H:i:s');

$pdo->beginTransaction();
try {
    $posStmt = $pdo->prepare('SELECT * FROM crypto_positions WHERE user_id = :uid AND symbol = :symbol FOR UPDATE');
    $posStmt->execute([':uid' => $uid, ':symbol' => $symbol]);
    $posRow = $posStmt->fetch();

    $current = $posRow
        ? ['qty' => (float) $posRow['qty'], 'avg' => (float) $posRow['avg_price'], 'realized' => (float) $posRow['realized_pnl']]
        : ['qty' => 0.0, 'avg' => 0.0, 'realized' => 0.0];

    [$updated, $realizedDelta] = tl_apply_crypto_fill($current, $side, $qty, $price);

    if ($posRow === false) {
        $pdo->prepare(
            'INSERT INTO crypto_positions (user_id, symbol, qty, avg_price, realized_pnl, updated_at)
             VALUES (:uid, :symbol, :qty, :avg, :realized, :updated_at)'
        )->execute([
            ':uid' => $uid, ':symbol' => $symbol, ':qty' => $updated['qty'],
            ':avg' => $updated['avg'], ':realized' => $updated['realized'], ':updated_at' => $now,
        ]);
    } else {
        $pdo->prepare(
            'UPDATE crypto_positions SET qty = :qty, avg_price = :avg, realized_pnl = :realized, updated_at = :updated_at
             WHERE user_id = :uid AND symbol = :symbol'
        )->execute([
            ':qty' => $updated['qty'], ':avg' => $updated['avg'], ':realized' => $updated['realized'],
            ':updated_at' => $now, ':uid' => $uid, ':symbol' => $symbol,
        ]);
    }

    $pdo->prepare(
        'INSERT INTO crypto_orders (user_id, client_id, symbol, side, qty, price, created_at)
         VALUES (:uid, :cid, :symbol, :side, :qty, :price, :created_at)'
    )->execute([
        ':uid' => $uid, ':cid' => $clientId, ':symbol' => $symbol, ':side' => $side,
        ':qty' => $qty, ':price' => $price, ':created_at' => $now,
    ]);

    tl_log_fill_event($pdo, [
        'user_id' => $uid, 'market' => 'crypto', 'symbol' => $symbol, 'side' => $side,
        'reason' => 'crypto_market_fill', 'qty' => $qty, 'price' => $price,
        'pnl_delta' => $realizedDelta !== 0.0 ? $realizedDelta : null, 'client_id' => $clientId, 'created_at' => $now,
    ]);

    $pdo->commit();
} catch (PDOException $e) {
    $pdo->rollBack();
    // Duplicate-key race on crypto_orders (two near-simultaneous requests
    // with the same clientId) - the loser just reads back the winner.
    $existingOrder->execute([':uid' => $uid, ':cid' => $clientId]);
    if ($row = $existingOrder->fetch()) {
        $posStmt2 = $pdo->prepare('SELECT * FROM crypto_positions WHERE user_id = :uid AND symbol = :symbol');
        $posStmt2->execute([':uid' => $uid, ':symbol' => $row['symbol']]);
        $posRow2 = $posStmt2->fetch();
        tl_json([
            'ok' => true, 'duplicate' => true, 'price' => (float) $row['price'],
            'order' => tl_crypto_order_row_to_client($row),
            'position' => $posRow2 ? tl_crypto_position_row_to_client($posRow2) : ['qty' => 0.0, 'avg' => 0.0, 'realized' => 0.0],
        ]);
    }
    error_log('crypto/order failed: ' . $e->getMessage());
    tl_error('Could not place order. Please try again.', 500);
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('crypto/order failed: ' . $e->getMessage());
    tl_error('Could not place order. Please try again.', 500);
}

tl_json([
    'ok' => true,
    'duplicate' => false,
    'price' => $price,
    'order' => ['id' => $clientId, 'ts' => tl_datetime_to_ms($now), 'symbol' => $symbol, 'side' => strtoupper($side), 'qty' => $qty, 'price' => $price, 'status' => 'Filled'],
    'position' => $updated,
]);
