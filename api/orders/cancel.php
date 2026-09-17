<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

/*
 * Cancels a not-yet-filled working (limit/stop) order. No price authority
 * involved here - nothing has filled, so there's nothing to authenticate -
 * but this still has to exist and actually be called by the client: once
 * check-fills.php is the one deciding fills server-side, a working order
 * the user "cancelled" only in their local UI would otherwise still sit in
 * the working_orders table and could trigger for real on the next
 * reconciliation poll.
 */

tl_require_method('POST');
tl_check_same_origin();

$user = tl_require_auth();
$body = tl_read_json_body();
$uid = $user['id'];

try {
    $clientId = tl_expect_string($body['id'] ?? null, 'id', 40);
} catch (InvalidArgumentException $e) {
    tl_error($e->getMessage(), 400);
}

$pdo = tl_db();
$stmt = $pdo->prepare('DELETE FROM working_orders WHERE user_id = :uid AND client_id = :cid');
$stmt->execute([':uid' => $uid, ':cid' => $clientId]);

// Idempotent either way - "already cancelled/filled" and "cancelled just
// now" both end with the same end state (no such working order), so this
// never needs to be an error.
tl_json(['ok' => true, 'removed' => $stmt->rowCount() > 0]);
