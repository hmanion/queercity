<?php
// admin-options.php - returns existing entities for admin event-entry form.

header('Content-Type: application/json; charset=utf-8');

$configPath = __DIR__ . '/../config/db.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Server config missing']);
    exit;
}

$config = require $configPath;
$requiredToken = $config['import_token'] ?? '';
$providedToken = $_GET['token'] ?? $_POST['token'] ?? '';

if ($requiredToken === '' || $providedToken !== $requiredToken) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

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

    $cities = $pdo->query('SELECT id, name, region, country_code, timezone, slug FROM cities ORDER BY name ASC')->fetchAll();
    $places = $pdo->query('SELECT id, name FROM places WHERE name IS NOT NULL AND name <> "" ORDER BY name ASC')->fetchAll();
    $organizations = $pdo->query(
        'SELECT o.id, o.name, o.category, o.url, o.logo_url, o.audience_label_id, al.name AS audience_label
         FROM organizations o
         LEFT JOIN audience_labels al ON al.id = o.audience_label_id
         WHERE o.name IS NOT NULL AND o.name <> ""
         ORDER BY o.name ASC'
    )->fetchAll();
    $audienceLabels = $pdo->query('SELECT id, name FROM audience_labels ORDER BY id ASC')->fetchAll();
    $tags = $pdo->query('SELECT id, name FROM tags ORDER BY name ASC')->fetchAll();

    echo json_encode([
        'cities' => $cities,
        'places' => $places,
        'organizations' => $organizations,
        'audience_labels' => $audienceLabels,
        'organization_categories' => ['Charity', 'Sports', 'Social', 'Arts', 'Club', 'Life', 'Sexy'],
        'tags' => $tags,
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to load options']);
}
