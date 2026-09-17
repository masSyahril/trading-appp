<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

/*
 * Updates the trigger price of a not-yet-filled working (limit/stop)
 * order. Same reasoning as cancel.php: no price authority involved (it's
 * still just a target, not a fill), but the server's own copy has to be
 * kept in sync or check-fills.php would keep triggering against the old
 * price.
 */

tl_require_method('POST');
tl_check_same_origin();

$user = tl_require_auth();
$body = tl_read_json_body();
$uid = $user['id'];

try {
    $clientId = tl_expect_string($body['id'] ?? null, 'id', 40);
    $price = tl_expect_number($body['price'] ?? null, 'price', 0.000001, 1e12);
} catch (InvalidArgumentException $e) {
    tl_error($e->getMessage(), 400);
}

$pdo = tl_db();
$stmt = $pdo->prepare('UPDATE working_orders SET price = :price WHERE user_id = :uid AND client_id = :cid');
$stmt->execute([':price' => $price, ':uid' => $uid, ':cid' => $clientId]);

if ($stmt->rowCount() === 0) {
    // Already filled/cancelled elsewhere in the meantime - not an error,
    // just nothing left to edit.
    tl_json(['ok' => true, 'updated' => false]);
}

$orderStmt = $pdo->prepare('SELECT * FROM working_orders WHERE user_id = :uid AND client_id = :cid');
$orderStmt->execute([':uid' => $uid, ':cid' => $clientId]);
tl_json(['ok' => true, 'updated' => true, 'order' => tl_order_row_to_client($orderStmt->fetch())]);
