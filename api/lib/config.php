<?php
declare(strict_types=1);

/**
 * Loads api/config/secrets.local.php once per request and caches it.
 * Fails loudly (as JSON, since every caller is an API endpoint) if the
 * local secrets file hasn't been created yet from secrets.example.php.
 */
function tl_app_config(): array {
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $localPath = __DIR__ . '/../config/secrets.local.php';
    if (!is_file($localPath)) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'error' => 'Server misconfigured: api/config/secrets.local.php is missing. '
                . 'Copy api/config/secrets.example.php to secrets.local.php and fill in your DB settings.',
        ]);
        exit;
    }

    $config = require $localPath;
    return $config;
}
