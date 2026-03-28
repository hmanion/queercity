<?php
// admin-options.php - returns existing entities for admin event-entry form.

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/lib/prides_query.php';
require_once __DIR__ . '/lib/event_domain.php';
require_once __DIR__ . '/lib/admin_auth.php';

$configPath = __DIR__ . '/../config/db.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Server config missing']);
    exit;
}

$config = require $configPath;
$providedToken = qc_admin_extract_token();
if (!qc_admin_token_is_valid($providedToken)) {
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
    $hasAudienceLabelsTable = qc_table_exists($pdo, 'audience_labels');
    $hasOrgCategory = qc_column_exists($pdo, 'organizations', 'category');
    $hasOrgLogo = qc_column_exists($pdo, 'organizations', 'logo_url');
    $hasOrgAudience = qc_column_exists($pdo, 'organizations', 'audience_label_id');
    $prides = qc_fetch_prides($pdo, true);

    if ($hasAudienceLabelsTable && $hasOrgAudience) {
        $organizations = $pdo->query(
            'SELECT o.id, o.name, ' .
            ($hasOrgCategory ? 'o.category' : 'NULL AS category') . ', ' .
            'o.url, ' .
            ($hasOrgLogo ? 'o.logo_url' : 'NULL AS logo_url') . ', ' .
            'o.audience_label_id, al.name AS audience_label
             FROM organizations o
             LEFT JOIN audience_labels al ON al.id = o.audience_label_id
             WHERE o.name IS NOT NULL AND o.name <> ""
             ORDER BY o.name ASC'
        )->fetchAll();
        $audienceLabels = $pdo->query('SELECT id, name FROM audience_labels ORDER BY id ASC')->fetchAll();
    } else {
        $organizations = $pdo->query(
            'SELECT id, name, ' .
            ($hasOrgCategory ? 'category' : 'NULL AS category') . ', ' .
            'url, ' .
            ($hasOrgLogo ? 'logo_url' : 'NULL AS logo_url') . ',
             NULL AS audience_label_id,
             NULL AS audience_label
             FROM organizations
             WHERE name IS NOT NULL AND name <> ""
             ORDER BY name ASC'
        )->fetchAll();
        $audienceLabels = [];
    }
    $tags = $pdo->query('SELECT id, name FROM tags ORDER BY name ASC')->fetchAll();

    echo json_encode([
        'cities' => $cities,
        'places' => $places,
        'organizations' => $organizations,
        'audience_labels' => $audienceLabels,
        'event_categories' => event_genre_allowed_labels(),
        'organization_categories' => ['Charity', 'Activity', 'Social', 'Arts', 'Club', 'Life', 'Sexy'],
        'tags' => $tags,
        'prides' => array_map(static function (array $pride): array {
            return [
                'id' => $pride['id'],
                'name' => $pride['name'],
                'borough' => $pride['borough'],
                'location' => $pride['location'],
                'published' => $pride['published'],
            ];
        }, $prides),
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to load options: ' . $e->getMessage()]);
}
