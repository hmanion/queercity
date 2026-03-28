<?php

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/lib/prides_query.php';

$configPath = __DIR__ . '/../config/db.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Server config missing']);
    exit;
}

$config = require $configPath;

try {
    $pdo = new PDO(
        "mysql:host={$config['host']};port={$config['port']};dbname={$config['name']};charset=utf8mb4",
        $config['user'],
        $config['pass'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    echo json_encode(
        qc_fetch_prides($pdo, false),
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to load prides: ' . $e->getMessage()]);
}
