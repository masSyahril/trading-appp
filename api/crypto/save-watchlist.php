<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

/*
 * Crypto counterpart of api/state/save.php - watchlist only, no financial
 * data (crypto positions/orders are never client-writable; they only ever
 * change through api/crypto/order.php, which prices them server-side).
 */

tl_require_method('POST');
tl_check_same_origin();

$user = tl_require_auth();
$body = tl_read_json_body();

try {
    $watchlist = tl_validate_crypto_watchlist_payload($body);
} catch (InvalidArgumentException $e) {
    tl_error($e->getMessage(), 400);
}

if ($watchlist === null) {
    tl_json(['ok' => true, 'updated' => false]);
}

$pdo = tl_db();
$uid = $user['id'];

$pdo->beginTransaction();
try {
    $pdo->prepare('DELETE FROM crypto_watchlist_items WHERE user_id = :uid')->execute([':uid' => $uid]);
    if (count($watchlist) > 0) {
        $insertWatch = $pdo->prepare(
            'INSERT INTO crypto_watchlist_items (user_id, symbol, sort_order) VALUES (:uid, :symbol, :sort_order)'
        );
        foreach (array_values($watchlist) as $i => $symbol) {
            $insertWatch->execute([':uid' => $uid, ':symbol' => $symbol, ':sort_order' => $i]);
        }
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('crypto/save-watchlist failed: ' . $e->getMessage());
    tl_error('Could not save your watchlist. Please try again.', 500);
}

tl_json(['ok' => true, 'updated' => true]);
