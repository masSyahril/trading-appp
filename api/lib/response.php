<?php
declare(strict_types=1);

function tl_json(array $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

function tl_error(string $message, int $status = 400, array $extra = []): void {
    tl_json(array_merge(['error' => $message], $extra), $status);
}

function tl_require_method(string $method): void {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) {
        tl_error('Method not allowed', 405);
    }
}

/** Reads a JSON request body into an assoc array; returns [] for empty/invalid bodies. */
function tl_read_json_body(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
