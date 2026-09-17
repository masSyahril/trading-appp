<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

/*
 * Used to wholesale-replace a signed-in user's ENTIRE portfolio (balance,
 * positions, working orders, history) with whatever the browser sent -
 * exactly the gap flagged since the portfolio-sync pass (see
 * api/db/schema_portfolio.sql). That's now closed: opening/closing/
 * cancelling/repricing an order goes through api/orders/*.php, which fetch
 * their own live prices and write one row at a time instead of trusting a
 * bulk client snapshot.
 *
 * This endpoint's only remaining job is the watchlist and price alerts -
 * plain lists with no financial consequence, so there's nothing to protect
 * by moving them server-side too. A request that still includes a "portfolio"
 * key is rejected outright (loudly, not silently ignored) so an old cached
 * page or a stale client build doesn't quietly fail to save trades anymore
 * without anyone noticing.
 */

tl_require_method('POST');
tl_check_same_origin();

$user = tl_require_auth();
$body = tl_read_json_body();

if (array_key_exists('portfolio', $body)) {
    tl_error(
        'This endpoint no longer accepts portfolio data. Positions and orders are now placed/closed/cancelled '
        . 'through api/orders/*.php, which price them server-side. See docs/SETUP_AUTH.md.',
        400
    );
}

try {
    $watchlist = tl_validate_watchlist_payload($body);
    $alerts = tl_validate_alerts_payload($body);
} catch (InvalidArgumentException $e) {
    tl_error($e->getMessage(), 400);
}

if ($watchlist === null && $alerts === null) {
    tl_json(['ok' => true, 'updated' => false]);
}

$pdo = tl_db();
$uid = $user['id'];

$pdo->beginTransaction();
try {
    if ($watchlist !== null) {
        $pdo->prepare('DELETE FROM watchlist_items WHERE user_id = :uid')->execute([':uid' => $uid]);
        if (count($watchlist) > 0) {
            $insertWatch = $pdo->prepare(
                'INSERT INTO watchlist_items (user_id, symbol, sort_order) VALUES (:uid, :symbol, :sort_order)'
            );
            foreach (array_values($watchlist) as $i => $symbol) {
                $insertWatch->execute([':uid' => $uid, ':symbol' => $symbol, ':sort_order' => $i]);
            }
        }
    }

    if ($alerts !== null) {
        // Alerts have no financial consequence (see schema_alerts.sql) -
        // same "replace the whole list" approach as watchlist, just keyed
        // on price-alerts.js's own alert ids instead of a sort order.
        $pdo->prepare('DELETE FROM price_alerts WHERE user_id = :uid')->execute([':uid' => $uid]);
        if (count($alerts) > 0) {
            $insertAlert = $pdo->prepare(
                'INSERT INTO price_alerts (user_id, alert_id, symbol, price) VALUES (:uid, :alert_id, :symbol, :price)'
            );
            foreach ($alerts as $a) {
                $insertAlert->execute([':uid' => $uid, ':alert_id' => $a['id'], ':symbol' => $a['symbol'], ':price' => $a['price']]);
            }
        }
    }

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('state/save (watchlist/alerts) failed: ' . $e->getMessage());
    tl_error('Could not save your changes. Please try again.', 500);
}

tl_json(['ok' => true, 'updated' => true]);
