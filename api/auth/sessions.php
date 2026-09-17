<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

tl_require_method('GET');

$user = tl_require_auth();

tl_json(['sessions' => tl_list_sessions((int) $user['id'])]);
