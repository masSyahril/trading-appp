<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

/*
 * Server-authoritative order placement. This is the endpoint that actually
 * closes the gap flagged since the portfolio-sync pass: for a MARKET order,
 * the entry price comes from tl_fetch_latest_price() here on the server -
 * never from anything the client sends - so a modified browser can no
 * longer claim an arbitrary fill price for itself.
 *
 * For a LIMIT/STOP order there is no fill yet, so there's nothing to
 * price-authenticate at placement time - the client's trigger price is
 * exactly that, a target it's choosing, not a fill. What matters is that
 * once price crosses it, the ACTUAL fill price used is server-fetched too -
 * that happens later, in api/orders/check-fills.php.
 *
 * Idempotent on (user_id, client_id): a retried/double-submitted request
 * with the same clientId returns the position/order that already exists
 * instead of creating a second one, so a flaky connection can't double-fill.
 */

tl_require_method('POST');
tl_check_same_origin();

$user = tl_require_auth();
$body = tl_read_json_body();
$uid = $user['id'];

try {
    $clientId = tl_expect_client_id($body['clientId'] ?? null, 'clientId');
    $symbol = tl_expect_symbol($body['symbol'] ?? null, 'symbol');
    $side = tl_expect_side($body['side'] ?? null, 'side');
    $type = $body['type'] ?? null;
    tl_expect($type === 'market' || $type === 'limit' || $type === 'stop', "Invalid type: expected 'market', 'limit' or 'stop'");
    $size = tl_expect_number($body['size'] ?? null, 'size', 0.000001, 1e12);
    $leverage = tl_expect_number($body['leverage'] ?? 1, 'leverage', 0.01, 500);
    $sl = tl_expect_nullable_number($body['sl'] ?? null, 'sl', 0, 1e12);
    $tp = tl_expect_nullable_number($body['tp'] ?? null, 'tp', 0, 1e12);
    $triggerPrice = null;
    if ($type !== 'market') {
        $triggerPrice = tl_expect_number($body['price'] ?? null, 'price', 0.000001, 1e12);
    }
} catch (InvalidArgumentException $e) {
    tl_error($e->getMessage(), 400);
}

$pdo = tl_db();

// Idempotency check - a client_id already used for this user, in either
// table, means this exact submission already went through.
$existingPosition = $pdo->prepare('SELECT * FROM positions WHERE user_id = :uid AND client_id = :cid');
$existingPosition->execute([':uid' => $uid, ':cid' => $clientId]);
if ($row = $existingPosition->fetch()) {
    tl_json(['ok' => true, 'kind' => 'position', 'duplicate' => true, 'position' => tl_position_row_to_client($row)]);
}
$existingOrder = $pdo->prepare('SELECT * FROM working_orders WHERE user_id = :uid AND client_id = :cid');
$existingOrder->execute([':uid' => $uid, ':cid' => $clientId]);
if ($row = $existingOrder->fetch()) {
    tl_json(['ok' => true, 'kind' => 'order', 'duplicate' => true, 'order' => tl_order_row_to_client($row)]);
}

if ($type === 'market') {
    try {
        $quote = tl_fetch_latest_price($symbol);
    } catch (TlQuoteUnavailableException $e) {
        tl_error('Could not get a live price for ' . $symbol . ' right now. Please try again.', 502);
    }
    $entryPrice = $quote['last'];

    // Stored as an explicit UTC string via gmdate(), matching how every
    // other timestamp in this table is written (see
    // tl_expect_timestamp_ms in api/lib/portfolio.php) - relying on MySQL's
    // own NOW() instead would silently depend on the DB server's configured
    // timezone, which nothing else here does.
    $openedAt = gmdate('Y-m-d H:i:s');
    $insert = $pdo->prepare(
        'INSERT INTO positions (user_id, client_id, symbol, side, size, leverage, entry_price, sl, tp, opened_at)
         VALUES (:uid, :cid, :symbol, :side, :size, :leverage, :entry_price, :sl, :tp, :opened_at)'
    );
    try {
        $insert->execute([
            ':uid' => $uid,
            ':cid' => $clientId,
            ':symbol' => $symbol,
            ':side' => $side,
            ':size' => $size,
            ':leverage' => $leverage,
            ':entry_price' => $entryPrice,
            ':sl' => $sl,
            ':tp' => $tp,
            ':opened_at' => $openedAt,
        ]);
    } catch (PDOException $e) {
        // Duplicate-key race (two near-simultaneous requests with the same
        // clientId) - the row that lost the race just reads back the winner.
        $existingPosition->execute([':uid' => $uid, ':cid' => $clientId]);
        if ($row = $existingPosition->fetch()) {
            tl_json(['ok' => true, 'kind' => 'position', 'duplicate' => true, 'position' => tl_position_row_to_client($row)]);
        }
        error_log('orders/place market insert failed: ' . $e->getMessage());
        tl_error('Could not place order. Please try again.', 500);
    }

    tl_log_fill_event($pdo, [
        'user_id' => $uid, 'market' => 'stock', 'symbol' => $symbol, 'side' => $side,
        'reason' => 'market_fill', 'qty' => $size, 'price' => $entryPrice, 'client_id' => $clientId, 'created_at' => $openedAt,
    ]);

    $positionStmt = $pdo->prepare('SELECT * FROM positions WHERE user_id = :uid AND client_id = :cid');
    $positionStmt->execute([':uid' => $uid, ':cid' => $clientId]);
    tl_json(['ok' => true, 'kind' => 'position', 'duplicate' => false, 'position' => tl_position_row_to_client($positionStmt->fetch())]);
}

// limit or stop - store the trigger, no fill yet.
$createdAt = gmdate('Y-m-d H:i:s');
$insert = $pdo->prepare(
    'INSERT INTO working_orders (user_id, client_id, symbol, side, type, size, price, leverage, sl, tp, created_at)
     VALUES (:uid, :cid, :symbol, :side, :type, :size, :price, :leverage, :sl, :tp, :created_at)'
);
try {
    $insert->execute([
        ':uid' => $uid,
        ':cid' => $clientId,
        ':symbol' => $symbol,
        ':side' => $side,
        ':type' => $type,
        ':size' => $size,
        ':price' => $triggerPrice,
        ':leverage' => $leverage,
        ':sl' => $sl,
        ':tp' => $tp,
        ':created_at' => $createdAt,
    ]);
} catch (PDOException $e) {
    $existingOrder->execute([':uid' => $uid, ':cid' => $clientId]);
    if ($row = $existingOrder->fetch()) {
        tl_json(['ok' => true, 'kind' => 'order', 'duplicate' => true, 'order' => tl_order_row_to_client($row)]);
    }
    error_log('orders/place working order insert failed: ' . $e->getMessage());
    tl_error('Could not place order. Please try again.', 500);
}

$orderStmt = $pdo->prepare('SELECT * FROM working_orders WHERE user_id = :uid AND client_id = :cid');
$orderStmt->execute([':uid' => $uid, ':cid' => $clientId]);
tl_json(['ok' => true, 'kind' => 'order', 'duplicate' => false, 'order' => tl_order_row_to_client($orderStmt->fetch())]);
