<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
ini_set('default_charset', 'UTF-8');
mb_internal_encoding('UTF-8');

require __DIR__ . '/../app/helpers.php';
require __DIR__ . '/../app/logic.php';

try {
    $force = isset($_GET['refresh']);
    $data = get_data($force);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $exception) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Falha ao carregar dados',
        'detail' => $exception->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}