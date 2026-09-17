<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

tl_require_method('POST');
tl_check_same_origin();

$user = tl_require_auth();
$body = tl_read_json_body();

if (!empty($body['all_others'])) {
    $count = tl_revoke_other_sessions((int) $user['id']);
    tl_json(['message' => 'Logged out of other devices.', 'revoked' => $count]);
}

$publicId = (string) ($body['session_id'] ?? '');
if ($publicId === '' || !preg_match('/^[a-f0-9]{32}$/', $publicId)) {
    tl_error('Missing or invalid session id.');
}

$result = tl_revoke_session_by_public_id((int) $user['id'], $publicId);
if (!$result['found']) {
    tl_error('Session not found.', 404);
}

tl_json([
    'message' => 'Session logged out.',
    'was_current' => $result['was_current'],
]);
