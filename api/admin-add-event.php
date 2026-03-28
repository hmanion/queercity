<?php
// admin-add-event.php - create, update, list, and delete one-off events.

require_once __DIR__ . '/lib/event_domain.php';
require_once __DIR__ . '/lib/prides_query.php';
require_once __DIR__ . '/lib/admin_auth.php';

header('Content-Type: application/json; charset=utf-8');

const ORG_CATEGORIES = ['Charity', 'Activity', 'Social', 'Arts', 'Club', 'Life', 'Sexy'];

function fail_json($code, $message): void
{
    http_response_code($code);
    echo json_encode(['error' => $message], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function normalize_text($value): ?string
{
    if ($value === null) {
        return null;
    }
    $trimmed = trim((string)$value);
    return $trimmed === '' ? null : $trimmed;
}

function normalize_spaces($value): ?string
{
    $text = normalize_text($value);
    if ($text === null) {
        return null;
    }
    return preg_replace('/\s+/u', ' ', $text);
}

function abbreviate_street_words($value): ?string
{
    $text = normalize_spaces($value);
    if ($text === null) {
        return null;
    }
    // Replace only whole words, never substrings (e.g. "Roadhouse" stays "Roadhouse").
    $text = preg_replace('/\bstreet\b/i', 'St', $text);
    $text = preg_replace('/\broad\b/i', 'Rd', $text);
    return normalize_spaces($text);
}

function normalize_postal_code($value): ?string
{
    $text = normalize_spaces($value);
    if ($text === null) {
        return null;
    }
    return strtoupper($text);
}

function normalize_country_code($value): ?string
{
    $text = normalize_spaces($value);
    if ($text === null) {
        return null;
    }
    return strtoupper($text);
}

function canonical_address_text($value): string
{
    $text = normalize_spaces($value);
    if ($text === null) {
        return '';
    }
    $text = strtolower($text);
    $text = preg_replace('/[^a-z0-9]+/i', ' ', $text);
    return trim(preg_replace('/\s+/', ' ', $text));
}

function canonical_postal_code($value): string
{
    $text = normalize_postal_code($value);
    if ($text === null) {
        return '';
    }
    return strtolower(preg_replace('/[^a-z0-9]+/i', '', $text));
}

function canonical_country_code($value): string
{
    $text = normalize_country_code($value);
    if ($text === null) {
        return '';
    }
    return strtolower(trim($text));
}

function parse_datetime_local($value): ?string
{
    $v = trim((string)$value);
    if ($v === '') {
        return null;
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/', $v)) {
        return null;
    }
    return str_replace('T', ' ', $v) . ':00';
}

function parse_tag_ids($raw): array
{
    $out = [];
    if (!is_array($raw)) {
        return $out;
    }
    foreach ($raw as $tagIdRaw) {
        $tagId = (int)$tagIdRaw;
        if ($tagId > 0) {
            $out[] = $tagId;
        }
    }
    return array_values(array_unique($out));
}

function parse_new_tags($raw): array
{
    $out = [];
    if (!is_array($raw)) {
        return $out;
    }
    foreach ($raw as $tagNameRaw) {
        $tagName = normalize_text($tagNameRaw);
        if ($tagName !== null) {
            $out[] = $tagName;
        }
    }
    return $out;
}

function find_or_create_address(PDO $pdo, $street, $locality, $postalCode, $country): int
{
    $streetNormalized = abbreviate_street_words($street);
    $localityNormalized = normalize_spaces($locality);
    $postalNormalized = normalize_postal_code($postalCode);
    $countryNormalized = normalize_country_code($country);

    $streetCanonical = canonical_address_text($streetNormalized);
    $localityCanonical = canonical_address_text($localityNormalized);
    $postalCanonical = canonical_postal_code($postalNormalized);
    $countryCanonical = canonical_country_code($countryNormalized);

    $sel = $pdo->prepare(
        'SELECT id
         FROM postal_addresses
         WHERE LOWER(TRIM(REGEXP_REPLACE(COALESCE(street_address, \'\'), \'[^a-zA-Z0-9]+\', \' \'))) = ?
           AND LOWER(TRIM(REGEXP_REPLACE(COALESCE(address_locality, \'\'), \'[^a-zA-Z0-9]+\', \' \'))) = ?
           AND LOWER(TRIM(REGEXP_REPLACE(COALESCE(postal_code, \'\'), \'[^a-zA-Z0-9]+\', \'\'))) = ?
           AND LOWER(TRIM(COALESCE(address_country, \'\'))) = ?
         ORDER BY id ASC
         LIMIT 1'
    );
    $sel->execute([$streetCanonical, $localityCanonical, $postalCanonical, $countryCanonical]);
    $found = $sel->fetch();
    if ($found) {
        return (int)$found['id'];
    }

    $ins = $pdo->prepare('INSERT INTO postal_addresses (street_address, address_locality, postal_code, address_country) VALUES (?, ?, ?, ?)');
    $ins->execute([$streetNormalized, $localityNormalized, $postalNormalized, $countryNormalized]);
    return (int)$pdo->lastInsertId();
}

function find_or_create_place(PDO $pdo, $name, $addressId, $cityId): int
{
    $sel = $pdo->prepare('SELECT id FROM places WHERE name <=> ? AND address_id <=> ? LIMIT 1');
    $sel->execute([$name, $addressId]);
    $found = $sel->fetch();
    if ($found) {
        return (int)$found['id'];
    }

    $ins = $pdo->prepare('INSERT INTO places (name, address_id, city_id) VALUES (?, ?, ?)');
    $ins->execute([$name, $addressId, $cityId]);
    return (int)$pdo->lastInsertId();
}

function find_or_create_organization(PDO $pdo, $name, $category, $url, $logoUrl, $audienceLabelId, $cityId, array $schemaFlags): int
{
    $sel = $pdo->prepare('SELECT id FROM organizations WHERE name = ? LIMIT 1');
    $sel->execute([$name]);
    $found = $sel->fetch();
    if ($found) {
        return (int)$found['id'];
    }

    if ($schemaFlags['hasOrgCategory'] && $schemaFlags['hasOrgAudience'] && $schemaFlags['hasOrgLogo']) {
        $ins = $pdo->prepare('INSERT INTO organizations (name, category, url, logo_url, audience_label_id) VALUES (?, ?, ?, ?, ?)');
        $ins->execute([$name, $category, $url, $logoUrl, $audienceLabelId]);
    } elseif ($schemaFlags['hasOrgCategory']) {
        $ins = $pdo->prepare('INSERT INTO organizations (name, category, url) VALUES (?, ?, ?)');
        $ins->execute([$name, $category, $url]);
    } elseif ($schemaFlags['hasOrgCity']) {
        $ins = $pdo->prepare('INSERT INTO organizations (name, url, city_id) VALUES (?, ?, ?)');
        $ins->execute([$name, $url, $cityId]);
    } else {
        $ins = $pdo->prepare('INSERT INTO organizations (name, url) VALUES (?, ?)');
        $ins->execute([$name, $url]);
    }
    return (int)$pdo->lastInsertId();
}

function link_organization_place(PDO $pdo, int $organizationId, int $placeId): void
{
    $ins = $pdo->prepare('INSERT IGNORE INTO organization_places (organization_id, place_id) VALUES (?, ?)');
    $ins->execute([$organizationId, $placeId]);
}

function find_or_create_tag(PDO $pdo, $name): ?int
{
    $normalized = strtolower(trim((string)$name));
    if ($normalized === '') {
        return null;
    }

    $sel = $pdo->prepare('SELECT id FROM tags WHERE name = ? LIMIT 1');
    $sel->execute([$normalized]);
    $found = $sel->fetch();
    if ($found) {
        return (int)$found['id'];
    }

    $ins = $pdo->prepare('INSERT INTO tags (name) VALUES (?)');
    $ins->execute([$normalized]);
    return (int)$pdo->lastInsertId();
}

function fetch_schema_flags(PDO $pdo): array
{
    return [
        'hasAudienceLabelsTable' => qc_table_exists($pdo, 'audience_labels'),
        'hasOrganizationPlacesTable' => qc_table_exists($pdo, 'organization_places'),
        'hasPridesTable' => qc_table_exists($pdo, 'prides'),
        'hasSchedulesTable' => qc_table_exists($pdo, 'schedules'),
        'hasScheduleByDayTable' => qc_table_exists($pdo, 'schedule_by_day'),
        'hasOrgCategory' => qc_column_exists($pdo, 'organizations', 'category'),
        'hasOrgLogo' => qc_column_exists($pdo, 'organizations', 'logo_url'),
        'hasOrgAudience' => qc_column_exists($pdo, 'organizations', 'audience_label_id'),
        'hasOrgCity' => qc_column_exists($pdo, 'organizations', 'city_id'),
        'hasEventAudience' => qc_column_exists($pdo, 'events', 'audience_label_id'),
        'hasEventPride' => qc_column_exists($pdo, 'events', 'pride_id'),
    ];
}

function fetch_admin_events(PDO $pdo, array $schemaFlags, int $limit = 300): array
{
    $selectPride = $schemaFlags['hasEventPride'] ? 'e.pride_id' : 'NULL AS pride_id';
    $selectAudience = $schemaFlags['hasEventAudience'] ? 'e.audience_label_id AS event_audience_label_id' : 'NULL AS event_audience_label_id';

    $sql = "
SELECT
  e.id,
  e.identifier,
  e.name,
  e.description,
  e.url,
  e.image_url,
  e.genre,
  e.keywords_text,
  e.event_status,
  e.attendance_mode,
  e.start_datetime,
  e.end_datetime,
  e.city_id,
  e.place_id,
  {$selectAudience},
  {$selectPride},
  o.price,
  o.price_currency,
  o.url AS offer_url,
  eo.organization_id,
  eo.role AS organization_role,
  GROUP_CONCAT(DISTINCT et.tag_id ORDER BY et.tag_id SEPARATOR ',') AS tag_ids_csv
FROM events e
LEFT JOIN offers o ON o.event_id = e.id
LEFT JOIN (
  SELECT event_id, MIN(organization_id) AS organization_id, MIN(role) AS role
  FROM event_organizations
  GROUP BY event_id
) eo ON eo.event_id = e.id
LEFT JOIN event_tags et ON et.event_id = e.id
GROUP BY
  e.id, e.identifier, e.name, e.description, e.url, e.image_url, e.genre, e.keywords_text,
  e.event_status, e.attendance_mode, e.start_datetime, e.end_datetime, e.city_id, e.place_id,
  event_audience_label_id, pride_id, o.price, o.price_currency, o.url, eo.organization_id, eo.role
ORDER BY e.start_datetime DESC, e.id DESC
LIMIT " . max(1, min(1000, $limit));

    $rows = $pdo->query($sql)->fetchAll();
    return array_map(static function (array $row): array {
        $tagIds = [];
        if (!empty($row['tag_ids_csv'])) {
            $tagIds = array_map('intval', explode(',', (string)$row['tag_ids_csv']));
            $tagIds = array_values(array_filter($tagIds, static fn(int $id): bool => $id > 0));
        }
        return [
            'id' => (int)$row['id'],
            'identifier' => $row['identifier'],
            'name' => $row['name'],
            'description' => $row['description'],
            'url' => $row['url'],
            'image_url' => $row['image_url'],
            'genre' => normalize_event_genre_label($row['genre']),
            'keywords_text' => $row['keywords_text'],
            'event_status' => $row['event_status'],
            'attendance_mode' => $row['attendance_mode'],
            'start_datetime' => $row['start_datetime'],
            'end_datetime' => $row['end_datetime'],
            'city_id' => isset($row['city_id']) ? (int)$row['city_id'] : 0,
            'place_id' => isset($row['place_id']) ? (int)$row['place_id'] : 0,
            'event_audience_label_id' => isset($row['event_audience_label_id']) ? (int)$row['event_audience_label_id'] : 0,
            'pride_id' => isset($row['pride_id']) ? (int)$row['pride_id'] : 0,
            'price' => $row['price'],
            'price_currency' => $row['price_currency'],
            'offer_url' => $row['offer_url'],
            'organization_id' => isset($row['organization_id']) ? (int)$row['organization_id'] : 0,
            'organization_role' => $row['organization_role'],
            'tag_ids' => $tagIds,
        ];
    }, $rows);
}

function replace_event_organization(PDO $pdo, array $schemaFlags, int $eventId, int $organizationId, ?string $organizationRole, int $placeId): void
{
    $pdo->prepare('DELETE FROM event_organizations WHERE event_id = ?')->execute([$eventId]);
    if ($organizationId <= 0) {
        return;
    }
    if ($schemaFlags['hasOrganizationPlacesTable']) {
        link_organization_place($pdo, $organizationId, $placeId);
    }
    $insEventOrg = $pdo->prepare('INSERT INTO event_organizations (event_id, organization_id, role) VALUES (?, ?, ?)');
    $insEventOrg->execute([$eventId, $organizationId, $organizationRole]);
}

function replace_event_offer(PDO $pdo, int $eventId, $price, ?string $priceCurrency, ?string $offerUrl): void
{
    $pdo->prepare('DELETE FROM offers WHERE event_id = ?')->execute([$eventId]);
    if ($price === null && $priceCurrency === null && $offerUrl === null) {
        return;
    }
    $insOffer = $pdo->prepare('INSERT INTO offers (event_id, price, price_currency, url) VALUES (?, ?, ?, ?)');
    $insOffer->execute([$eventId, $price, $priceCurrency, $offerUrl]);
}

function replace_event_tags(PDO $pdo, int $eventId, array $selectedTagIds, array $newTagNames): void
{
    $pdo->prepare('DELETE FROM event_tags WHERE event_id = ?')->execute([$eventId]);

    $insEventTag = $pdo->prepare('INSERT IGNORE INTO event_tags (event_id, tag_id) VALUES (?, ?)');
    foreach ($selectedTagIds as $tagId) {
        $insEventTag->execute([$eventId, $tagId]);
    }

    foreach ($newTagNames as $tagName) {
        $tagId = find_or_create_tag($pdo, $tagName);
        if ($tagId !== null) {
            $insEventTag->execute([$eventId, $tagId]);
        }
    }
}

$configPath = __DIR__ . '/../config/db.php';
if (!file_exists($configPath)) {
    fail_json(500, 'Server config missing');
}

$config = require $configPath;

$rawBody = file_get_contents('php://input');
$data = json_decode($rawBody ?: '{}', true);
if (!is_array($data)) {
    $data = [];
}

$providedToken = qc_admin_extract_token([$data['token'] ?? null]);
if (!qc_admin_token_is_valid($providedToken)) {
    fail_json(403, 'Forbidden');
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

    $schemaFlags = fetch_schema_flags($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        echo json_encode([
            'events' => fetch_admin_events($pdo, $schemaFlags),
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        fail_json(405, 'Method not allowed');
    }

    $action = strtolower(trim((string)($data['action'] ?? 'save')));
    if ($action === '') {
        $action = 'save';
    }

    if ($action === 'delete') {
        $eventId = isset($data['id']) ? (int)$data['id'] : 0;
        if ($eventId <= 0) {
            fail_json(422, 'An event id is required');
        }

        $pdo->beginTransaction();
        $exists = $pdo->prepare('SELECT id FROM events WHERE id = ? LIMIT 1');
        $exists->execute([$eventId]);
        if (!$exists->fetch()) {
            fail_json(404, 'Event not found');
        }

        if ($schemaFlags['hasSchedulesTable']) {
            $scheduleIds = $pdo->prepare('SELECT id FROM schedules WHERE event_id = ?');
            $scheduleIds->execute([$eventId]);
            $ids = array_map(static fn(array $r): int => (int)$r['id'], $scheduleIds->fetchAll());
            if (!empty($ids) && $schemaFlags['hasScheduleByDayTable']) {
                $in = implode(',', array_fill(0, count($ids), '?'));
                $delByDay = $pdo->prepare("DELETE FROM schedule_by_day WHERE schedule_id IN ($in)");
                $delByDay->execute($ids);
            }
            $pdo->prepare('DELETE FROM schedules WHERE event_id = ?')->execute([$eventId]);
        }

        $pdo->prepare('DELETE FROM event_tags WHERE event_id = ?')->execute([$eventId]);
        $pdo->prepare('DELETE FROM event_organizations WHERE event_id = ?')->execute([$eventId]);
        $pdo->prepare('DELETE FROM offers WHERE event_id = ?')->execute([$eventId]);
        $pdo->prepare('DELETE FROM events WHERE id = ?')->execute([$eventId]);

        $pdo->commit();
        echo json_encode([
            'ok' => true,
            'deleted_id' => $eventId,
            'events' => fetch_admin_events($pdo, $schemaFlags),
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action !== 'save') {
        fail_json(422, 'Unknown action');
    }

    $eventId = isset($data['id']) ? (int)$data['id'] : 0;
    $isUpdate = $eventId > 0;
    $name = normalize_text($data['name'] ?? null);
    $description = normalize_text($data['description'] ?? null);
    $url = normalize_text($data['url'] ?? null);
    $imageUrl = normalize_text($data['image_url'] ?? null);
    $genre = normalize_event_genre_for_write($data['genre'] ?? null);
    $keywordsText = normalize_text($data['keywords_text'] ?? null);
    $identifier = normalize_text($data['identifier'] ?? null);
    $eventStatus = normalize_text($data['event_status'] ?? null);
    $attendanceMode = normalize_text($data['attendance_mode'] ?? null);
    $startDateTime = parse_datetime_local($data['start_datetime'] ?? '');
    $endDateTime = parse_datetime_local($data['end_datetime'] ?? '');

    if ($name === null) {
        fail_json(422, 'Event name is required');
    }
    if ($startDateTime === null) {
        fail_json(422, 'Start date/time is required and must be valid');
    }
    if (($data['genre'] ?? null) !== null && $genre === null) {
        fail_json(422, 'Category is invalid');
    }
    if ($endDateTime !== null && $endDateTime < $startDateTime) {
        fail_json(422, 'End date/time must be after start date/time');
    }

    $cityId = isset($data['city_id']) ? (int)$data['city_id'] : 0;
    if ($cityId <= 0) {
        fail_json(422, 'City is required');
    }

    $placeMode = $data['place_mode'] ?? 'existing';
    $placeId = isset($data['place_id']) ? (int)$data['place_id'] : 0;

    $organizationMode = $data['organization_mode'] ?? 'none';
    $organizationId = isset($data['organization_id']) ? (int)$data['organization_id'] : 0;
    $organizationRole = normalize_text($data['organization_role'] ?? null);
    $eventAudienceLabelId = isset($data['event_audience_label_id']) ? (int)$data['event_audience_label_id'] : 0;
    $prideId = isset($data['pride_id']) ? (int)$data['pride_id'] : 0;

    $selectedTagIds = parse_tag_ids($data['tag_ids'] ?? []);
    $newTagNames = parse_new_tags($data['new_tags'] ?? []);

    $price = null;
    if (isset($data['price']) && trim((string)$data['price']) !== '') {
        if (!is_numeric($data['price'])) {
            fail_json(422, 'Price must be numeric');
        }
        $price = (float)$data['price'];
    }
    $priceCurrency = normalize_text($data['price_currency'] ?? null);
    $offerUrl = normalize_text($data['offer_url'] ?? null);

    $pdo->beginTransaction();

    if ($eventId > 0) {
        $checkEvent = $pdo->prepare('SELECT id FROM events WHERE id = ?');
        $checkEvent->execute([$eventId]);
        if (!$checkEvent->fetch()) {
            fail_json(404, 'Event not found');
        }
    }

    $checkCity = $pdo->prepare('SELECT id FROM cities WHERE id = ?');
    $checkCity->execute([$cityId]);
    if (!$checkCity->fetch()) {
        fail_json(422, 'Selected city does not exist');
    }

    if ($eventAudienceLabelId > 0 && $schemaFlags['hasAudienceLabelsTable']) {
        $checkAudience = $pdo->prepare('SELECT id FROM audience_labels WHERE id = ?');
        $checkAudience->execute([$eventAudienceLabelId]);
        if (!$checkAudience->fetch()) {
            fail_json(422, 'Selected event audience label does not exist');
        }
    } else {
        $eventAudienceLabelId = null;
    }

    if ($prideId > 0) {
        if (!$schemaFlags['hasPridesTable'] || !$schemaFlags['hasEventPride']) {
            fail_json(422, 'Prides support is not available in this database schema yet');
        }
        $checkPride = $pdo->prepare('SELECT id FROM prides WHERE id = ?');
        $checkPride->execute([$prideId]);
        if (!$checkPride->fetch()) {
            fail_json(422, 'Selected pride does not exist');
        }
    } else {
        $prideId = null;
    }

    if ($placeMode === 'existing') {
        if ($placeId <= 0) {
            fail_json(422, 'Please choose an existing place');
        }
        $checkPlace = $pdo->prepare('SELECT id FROM places WHERE id = ?');
        $checkPlace->execute([$placeId]);
        if (!$checkPlace->fetch()) {
            fail_json(422, 'Selected place does not exist');
        }
    } elseif ($placeMode === 'new') {
        $placeName = normalize_text($data['new_place_name'] ?? null);
        if ($placeName === null) {
            fail_json(422, 'New place name is required');
        }

        $street = normalize_text($data['new_place_street_address'] ?? null);
        $locality = normalize_text($data['new_place_locality'] ?? null);
        $postalCode = normalize_text($data['new_place_postal_code'] ?? null);
        $country = normalize_text($data['new_place_country'] ?? null);

        $addressId = find_or_create_address($pdo, $street, $locality, $postalCode, $country);
        $placeId = find_or_create_place($pdo, $placeName, $addressId, $cityId);
    } else {
        fail_json(422, 'Invalid place mode');
    }

    if ($organizationMode === 'existing') {
        if ($organizationId <= 0) {
            fail_json(422, 'Please choose an existing organization');
        }
        $checkOrg = $pdo->prepare('SELECT id FROM organizations WHERE id = ?');
        $checkOrg->execute([$organizationId]);
        if (!$checkOrg->fetch()) {
            fail_json(422, 'Selected organization does not exist');
        }
    } elseif ($organizationMode === 'new') {
        $orgName = normalize_text($data['new_organization_name'] ?? null);
        $orgCategory = normalize_text($data['new_organization_category'] ?? null);
        $orgUrl = normalize_text($data['new_organization_url'] ?? null);
        $orgLogoUrl = normalize_text($data['new_organization_logo_url'] ?? null);
        $orgAudienceLabelId = isset($data['new_organization_audience_label_id']) ? (int)$data['new_organization_audience_label_id'] : 0;
        if ($orgName === null) {
            fail_json(422, 'New organization name is required');
        }
        if ($schemaFlags['hasOrgCategory'] && ($orgCategory === null || !in_array($orgCategory, ORG_CATEGORIES, true))) {
            fail_json(422, 'New organization category is required and must be valid');
        }
        if ($orgAudienceLabelId > 0 && $schemaFlags['hasAudienceLabelsTable']) {
            $checkAudience = $pdo->prepare('SELECT id FROM audience_labels WHERE id = ?');
            $checkAudience->execute([$orgAudienceLabelId]);
            if (!$checkAudience->fetch()) {
                fail_json(422, 'Selected organization audience label does not exist');
            }
        } else {
            $orgAudienceLabelId = null;
        }
        $organizationId = find_or_create_organization($pdo, $orgName, $orgCategory, $orgUrl, $orgLogoUrl, $orgAudienceLabelId, $cityId, $schemaFlags);
    } elseif ($organizationMode !== 'none') {
        fail_json(422, 'Invalid organization mode');
    }

    $eventColumns = [
        'identifier',
        'name',
        'description',
        'url',
        'image_url',
        'genre',
        'keywords_text',
        'event_status',
        'attendance_mode',
    ];
    $eventValues = [
        $identifier,
        $name,
        $description,
        $url,
        $imageUrl,
        $genre,
        $keywordsText,
        $eventStatus,
        $attendanceMode,
    ];

    if ($schemaFlags['hasEventAudience']) {
        $eventColumns[] = 'audience_label_id';
        $eventValues[] = $eventAudienceLabelId;
    }

    if ($schemaFlags['hasEventPride']) {
        $eventColumns[] = 'pride_id';
        $eventValues[] = $prideId;
    }

    $eventColumns = array_merge($eventColumns, ['place_id', 'city_id', 'start_datetime', 'end_datetime']);
    $eventValues = array_merge($eventValues, [$placeId, $cityId, $startDateTime, $endDateTime]);

    if ($eventId > 0) {
        $assignments = implode(', ', array_map(static fn(string $column): string => $column . ' = ?', $eventColumns));
        $stmt = $pdo->prepare('UPDATE events SET ' . $assignments . ' WHERE id = ?');
        $stmt->execute(array_merge($eventValues, [$eventId]));
    } else {
        $stmt = $pdo->prepare(
            'INSERT INTO events (' . implode(', ', $eventColumns) . ')
             VALUES (' . implode(', ', array_fill(0, count($eventColumns), '?')) . ')'
        );
        $stmt->execute($eventValues);
        $eventId = (int)$pdo->lastInsertId();
    }

    replace_event_organization($pdo, $schemaFlags, $eventId, $organizationId, $organizationRole, $placeId);
    replace_event_offer($pdo, $eventId, $price, $priceCurrency, $offerUrl);
    replace_event_tags($pdo, $eventId, $selectedTagIds, $newTagNames);

    $pdo->commit();

    echo json_encode([
        'ok' => true,
        'event_id' => $eventId,
        'message' => ($isUpdate ? 'Event saved successfully' : 'Event created successfully'),
        'events' => fetch_admin_events($pdo, $schemaFlags),
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fail_json(500, 'Failed to manage event: ' . $e->getMessage());
}
