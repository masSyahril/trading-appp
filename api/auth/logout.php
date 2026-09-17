<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

tl_require_method('POST');
tl_check_same_origin();

tl_destroy_current_session();
tl_json(['ok' => true]);
