<?php
// Copy this file to config.local.php (same folder) and fill in real values.
// config.local.php is gitignored (*.local.php) - never commit the token.
declare(strict_types=1);

return [
    'instagram' => [
        // Long-lived token from the "Instagram API with Instagram Login"
        // (Meta for Developers > your app > Instagram > API setup). The
        // account must be a Business or Creator account. Valid 60 days;
        // instagram.php refreshes it automatically before it expires and
        // keeps the newest one in cache/token.json, so this value is only
        // read the first time (or after the cache folder is wiped).
        'access_token' => '',

        // How many recent posts to return to the page.
        'limit' => 12,

        // Seconds a fetched feed is reused before Instagram is asked again.
        // Instagram rate-limits per account, so don't go much below 300.
        'cache_seconds' => 300,
    ],
];
