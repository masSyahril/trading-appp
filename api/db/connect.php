<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/config.php';

/**
 * Shared PDO connection, created once per request. All queries in api/
 * use prepared statements with bound parameters - never string-concatenate
 * user input into SQL.
 */
function tl_db(): PDO {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $db = tl_app_config()['db'];
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $db['host'],
        $db['port'],
        $db['name']
    );

    try {
        $pdo = new PDO($dsn, $db['user'], $db['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        // Deliberately don't echo $e->getMessage() - it can include the DSN/
        // credentials context. Log it server-side instead.
        error_log('tl_db connection failed: ' . $e->getMessage());
        echo json_encode(['error' => 'Database connection failed. Check api/config/secrets.local.php and that MySQL is running.']);
        exit;
    }

    return $pdo;
}
