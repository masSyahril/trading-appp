<?php
declare(strict_types=1);

/*
 * Background reconciliation job - runs api/lib/order_engine.php's fill/stop
 * logic for EVERY user with an outstanding working order or an sl/tp-bearing
 * position, not just whichever one user happens to have a browser tab open
 * polling api/orders/check-fills.php. This closes the gap flagged in
 * docs/SETUP_AUTH.md ("no background cron in this stack (plain XAMPP)") -
 * a stop-loss or limit order now fires on schedule instead of only when
 * someone happens to be looking at the app.
 *
 * This is a CLI script, not a web endpoint - it deliberately does NOT go
 * through api/bootstrap.php's session/mailer/etc includes, and refuses to
 * run under a web server SAPI so it can't accidentally be hit as a URL.
 *
 * --- How to schedule it on Windows (XAMPP) ---
 * Open Task Scheduler -> Create Task...
 *   General:  Name it e.g. "TradeLite check-fills". Run whether user is
 *             logged on or not (so it keeps firing if you lock your PC).
 *   Triggers: New... -> Daily, then check "Repeat task every: 1 minute"
 *             "for a duration of: Indefinitely".
 *   Actions:  New... -> Program/script:
 *               C:\xampp\php\php.exe
 *             Add arguments:
 *               "C:\xampp\htdocs\apptrdesign\trading-appp\api\jobs\run-check-fills.php"
 * That's it - XAMPP's Apache/MySQL don't need to be "started via the XAMPP
 * control panel" for this to work as long as they're running (this script
 * connects to MySQL directly, the same way every api/*.php file does).
 *
 * Every run prints one summary line per user it touched plus a final
 * totals line to stdout - Task Scheduler can log that (Settings tab ->
 * "enabled" history, or redirect output yourself) if you want a record.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    header('Content-Type: text/plain');
    echo "This script is for command-line use only.\n";
    exit(1);
}

require_once __DIR__ . '/../lib/config.php';
require_once __DIR__ . '/../db/connect.php';
require_once __DIR__ . '/../lib/portfolio.php';
require_once __DIR__ . '/../lib/quotes.php';
require_once __DIR__ . '/../lib/audit.php';
require_once __DIR__ . '/../lib/order_engine.php';

$startedAt = microtime(true);
$pdo = tl_db();

$userIds = tl_users_with_pending_orders($pdo);
$totalFilled = 0;
$totalClosed = 0;
$errors = 0;

fwrite(STDOUT, sprintf("[%s] run-check-fills: %d user(s) with pending orders/stops\n", gmdate('c'), count($userIds)));

foreach ($userIds as $uid) {
    try {
        $pdo->beginTransaction();
        $result = tl_reconcile_user_fills($pdo, $uid);
        $pdo->commit();

        $filledCount = count($result['filled']);
        $closedCount = count($result['closed']);
        $totalFilled += $filledCount;
        $totalClosed += $closedCount;

        if ($filledCount > 0 || $closedCount > 0) {
            fwrite(STDOUT, sprintf(
                "[%s]   uid %d: %d filled, %d closed (pnl %.2f)\n",
                gmdate('c'), $uid, $filledCount, $closedCount, $result['pnlTotal']
            ));
        }
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        $errors++;
        error_log('run-check-fills: uid ' . $uid . ' failed: ' . $e->getMessage());
        fwrite(STDERR, sprintf("[%s]   uid %d: ERROR - %s\n", gmdate('c'), $uid, $e->getMessage()));
        // One user's failure (e.g. a symbol Yahoo doesn't recognize anymore)
        // must never stop the rest of the batch from being processed.
        continue;
    }
}

$elapsedMs = (int) round((microtime(true) - $startedAt) * 1000);
fwrite(STDOUT, sprintf(
    "[%s] run-check-fills done: %d user(s), %d filled, %d closed, %d error(s), %dms\n",
    gmdate('c'), count($userIds), $totalFilled, $totalClosed, $errors, $elapsedMs
));

exit($errors > 0 ? 1 : 0);
