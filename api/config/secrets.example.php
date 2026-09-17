<?php
// Copy this file to secrets.local.php (same folder) and fill in real values.
// secrets.local.php is gitignored - never commit real credentials there.
declare(strict_types=1);

return [
    'db' => [
        'host' => '127.0.0.1',
        'port' => 3306,
        'name' => 'tradelite',
        'user' => 'root',
        'pass' => '', // XAMPP's default MySQL root password is empty
    ],

    'smtp' => [
        // Leave host empty to run in DEV MODE: verification and password
        // reset emails are written to api/logs/mail.log instead of being
        // sent, so you can copy the link out and test the flow without a
        // real mailbox configured yet.
        'host' => '',
        'port' => 587,
        'encryption' => 'tls', // 'tls' (STARTTLS, most providers on port 587) or 'ssl' (port 465)
        'username' => '',
        'password' => '',
        'from_email' => 'no-reply@tradelite.local',
        'from_name' => 'TradeLite',
    ],

    'app' => [
        // Used to build links inside emails (verify/reset). No trailing slash.
        'base_url' => 'http://localhost/apptrdesign/trading-appp',
        'session_cookie_name' => 'tl_session',
        'session_lifetime_days' => 30,
        // Set true once the site is served over HTTPS, so the session
        // cookie gets the Secure flag. Keep false for local http XAMPP dev.
        'force_https_cookies' => false,
    ],

    // Dev/test-only. Leave this whole key out entirely for a real
    // deployment. If set, api/orders/*.php and api/stocks.php's ?latest=1
    // read prices from this JSON file instead of calling Yahoo Finance -
    // useful for automated tests or offline development. File shape:
    // { "AAPL": 231.45, "TSLA": { "last": 410.2, "prevClose": 408.9 } }
    // 'quotes' => [
    //     'mock_file' => __DIR__ . '/../../test-quotes.json',
    // ],
];
