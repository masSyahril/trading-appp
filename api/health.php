<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

/*
 * Public health-check for uptime monitors (UptimeRobot or similar) - no
 * auth, no rate-limit, deliberately minimal. Confirms the app can actually
 * reach its database, not just that PHP itself is running. Point an
 * UptimeRobot HTTP(s) monitor at this URL once the app is deployed.
 */
header('Content-Type: application/json; charset=utf-8');

try {
    tl_db()->query('SELECT 1');
    http_response_code(200);
    echo json_encode(['status' => 'ok', 'time' => gmdate('c')]);
} catch (Throwable $e) {
    tl_report_error($e);
    http_response_code(503);
    echo json_encode(['status' => 'error', 'time' => gmdate('c')]);
}
