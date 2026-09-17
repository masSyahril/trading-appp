<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

/*
 * Crypto counterpart of api/state/bootstrap.php: called synchronously by
 * pages/auth/crypto-sync.js the moment crypto-trading/index.html loads, so
 * crypto-app.prod.js's very first localStorage read already sees this
 * account's server state. hasServerData is keyed off crypto_seed_marker
 * (see schema_crypto.sql) rather than "does this user have any positions",
 * since zero crypto positions is a perfectly normal state for an account
 * that HAS already been seeded/traded on.
 */

tl_require_method('GET');

$user = tl_current_user();
if ($user === null) {
    tl_json(['authenticated' => false]);
}

$pdo = tl_db();
$uid = $user['id'];

$seeded = $pdo->prepare('SELECT 1 FROM crypto_seed_marker WHERE user_id = :uid');
$seeded->execute([':uid' => $uid]);
if ($seeded->fetch() === false) {
    tl_json(['authenticated' => true, 'hasServerData' => false, 'positions' => null, 'orders' => null, 'watchlist' => null]);
}

$state = tl_get_full_crypto_state($pdo, $uid);

$watchStmt = $pdo->prepare('SELECT symbol FROM crypto_watchlist_items WHERE user_id = :uid ORDER BY sort_order');
$watchStmt->execute([':uid' => $uid]);
$watchlist = array_column($watchStmt->fetchAll(), 'symbol');

tl_json([
    'authenticated' => true,
    'hasServerData' => true,
    'positions' => $state['positions'],
    'orders' => $state['orders'],
    'watchlist' => $watchlist,
]);
