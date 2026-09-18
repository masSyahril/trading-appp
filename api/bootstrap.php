<?php
declare(strict_types=1);

// Single include point for every api/auth/*.php endpoint. Order matters:
// config before db, everything else after. An endpoint just does:
//   require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/lib/config.php';
require_once __DIR__ . '/lib/monitoring.php';
require_once __DIR__ . '/db/connect.php';
require_once __DIR__ . '/lib/response.php';
require_once __DIR__ . '/lib/security.php';
require_once __DIR__ . '/lib/session.php';
require_once __DIR__ . '/lib/mailer.php';
require_once __DIR__ . '/lib/portfolio.php';
require_once __DIR__ . '/lib/quotes.php';
require_once __DIR__ . '/lib/crypto.php';
require_once __DIR__ . '/lib/audit.php';
require_once __DIR__ . '/lib/order_engine.php';

// Catch anything an endpoint didn't handle itself (see lib/monitoring.php)
// so a bug becomes a logged error instead of a blank page or a leaked stack
// trace.
tl_register_error_reporting();
