<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

tl_require_method('GET');

$user = tl_current_user();
if ($user === null) {
    tl_json(['authenticated' => false, 'user' => null]);
}

tl_json(['authenticated' => true, 'user' => $user]);
