<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

/*
 * Server-side reconciliation: the only place limit/stop triggers and
 * stop-loss/take-profit hits actually execute once a user is
 * server-authoritative, using live prices this server fetches itself -
 * exactly the same trigger logic stock-market/js/portfolio.js runs
 * locally (checkWorkingOrderFills/checkPositionStops), just no longer
 * trusting the client to have run it honestly or at all.
 *
 * Called on a short poll by pages/auth/order-authority.js while a
 * signed-in user has a stock-market page open (for a fast, responsive
 * fill). The actual reconciliation logic lives in api/lib/order_engine.php
 * now, shared with api/jobs/run-check-fills.php - a background job that
 * runs this for EVERY user on a schedule, so a stop-loss or limit order
 * still fires even with no browser tab open. See docs/SETUP_AUTH.md.
 */

tl_require_method('POST');
tl_check_same_origin();

$user = tl_require_auth();
$uid = $user['id'];
$pdo = tl_db();

$pdo->beginTransaction();
try {
    $result = tl_reconcile_user_fills($pdo, $uid);
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('orders/check-fills failed: ' . $e->getMessage());
    tl_error('Could not reconcile orders. Please try again.', 500);
}

$state = tl_get_full_portfolio_state($pdo, $uid);
tl_json([
    'ok' => true,
    'filled' => $result['filled'],
    'closed' => $result['closed'],
    'portfolio' => $state,
]);
