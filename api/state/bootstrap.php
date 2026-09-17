<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

tl_require_method('GET');

$user = tl_current_user();
if ($user === null) {
    tl_json(['authenticated' => false]);
}

$pdo = tl_db();

$portfolio = tl_get_full_portfolio_state($pdo, $user['id']);
if ($portfolio === null) {
    // No server-side copy yet - the caller (portfolio-sync.js) should seed
    // one from whatever is currently in this browser's localStorage via
    // api/state/seed.php.
    tl_json(['authenticated' => true, 'hasServerData' => false, 'portfolio' => null, 'watchlist' => null, 'alerts' => null]);
}

$watchStmt = $pdo->prepare('SELECT symbol FROM watchlist_items WHERE user_id = :uid ORDER BY sort_order');
$watchStmt->execute([':uid' => $user['id']]);
$watchlist = array_column($watchStmt->fetchAll(), 'symbol');

$alertsStmt = $pdo->prepare('SELECT alert_id, symbol, price FROM price_alerts WHERE user_id = :uid ORDER BY created_at');
$alertsStmt->execute([':uid' => $user['id']]);
$alerts = tl_group_alerts_by_symbol($alertsStmt->fetchAll());

tl_json([
    'authenticated' => true,
    'hasServerData' => true,
    'portfolio' => $portfolio,
    'watchlist' => $watchlist,
    'alerts' => $alerts,
]);
