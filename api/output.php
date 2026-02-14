<?php
// output.php - one-off events JSON (Schema.org-like) from MySQL

require_once __DIR__ . '/lib/events_query.php';

$config = require __DIR__ . '/../config/db.php';

$pdo = new PDO(
    "mysql:host={$config['host']};port={$config['port']};dbname={$config['name']};charset=utf8mb4",
    $config['user'],
    $config['pass'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
);

$from = isset($_GET['from']) ? $_GET['from'] : null; // YYYY-MM-DD
$to = isset($_GET['to']) ? $_GET['to'] : null;       // YYYY-MM-DD
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 0;

$out = fetch_one_off_events($pdo, $from, $to, $limit);

header('Content-Type: application/json; charset=utf-8');
echo json_encode($out, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
