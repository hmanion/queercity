<?php
// admin-add-event.php - creates a one-off event and related entities.

header('Content-Type: application/json; charset=utf-8');

const ORG_CATEGORIES = ['Charity', 'Activity', 'Social', 'Arts', 'Club', 'Life', 'Sexy'];

function fail_json($code, $message) {
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit;
}

function normalize_text($value) {
    if ($value === null) {
        return null;
    }
    $trimmed = trim((string)$value);
    return $trimmed === '' ? null : $trimmed;
}

function normalize_spaces($value) {
    $text = normalize_text($value);
    if ($text === null) {
        return null;
    }
    return preg_replace('/\s+/u', ' ', $text);
}

function abbreviate_street_words($value) {
    $text = normalize_spaces($value);
    if ($text === null) {
        return null;
    }
    // Replace only whole words, never substrings (e.g. "Roadhouse" stays "Roadhouse").
    $text = preg_replace('/\bstreet\b/i', 'St', $text);
    $text = preg_replace('/\broad\b/i', 'Rd', $text);
    return normalize_spaces($text);
}

function normalize_postal_code($value) {
    $text = normalize_spaces($value);
    if ($text === null) {
        return null;
    }
    return strtoupper($text);
}

function normalize_country_code($value) {
    $text = normalize_spaces($value);
    if ($text === null) {
        return null;
    }
    return strtoupper($text);
}

function canonical_address_text($value) {
    $text = normalize_spaces($value);
    if ($text === null) {
        return '';
    }
    $text = strtolower($text);
    $text = preg_replace('/[^a-z0-9]+/i', ' ', $text);
    return trim(preg_replace('/\s+/', ' ', $text));
}

function canonical_postal_code($value) {
    $text = normalize_postal_code($value);
    if ($text === null) {
        return '';
    }
    return strtolower(preg_replace('/[^a-z0-9]+/i', '', $text));
}

function canonical_country_code($value) {
    $text = normalize_country_code($value);
    if ($text === null) {
        return '';
    }
    return strtolower(trim($text));
}

function parse_datetime_local($value) {
    $v = trim((string)$value);
    if ($v === '') {
        return null;
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/', $v)) {
        return null;
    }
    return str_replace('T', ' ', $v) . ':00';
}

function table_exists(PDO $pdo, $tableName) {
    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1'
    );
    $stmt->execute([$tableName]);
    return (bool)$stmt->fetchColumn();
}

function column_exists(PDO $pdo, $tableName, $columnName) {
    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1'
    );
    $stmt->execute([$tableName, $columnName]);
    return (bool)$stmt->fetchColumn();
}

function find_or_create_address(PDO $pdo, $street, $locality, $postalCode, $country) {
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

function find_or_create_place(PDO $pdo, $name, $addressId, $cityId) {
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

function find_or_create_organization(PDO $pdo, $name, $category, $url, $logoUrl, $audienceLabelId, $cityId, $schemaFlags) {
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

function link_organization_place(PDO $pdo, $organizationId, $placeId) {
    $ins = $pdo->prepare('INSERT IGNORE INTO organization_places (organization_id, place_id) VALUES (?, ?)');
    $ins->execute([$organizationId, $placeId]);
}

function find_or_create_tag(PDO $pdo, $name) {
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail_json(405, 'Method not allowed');
}

$configPath = __DIR__ . '/../config/db.php';
if (!file_exists($configPath)) {
    fail_json(500, 'Server config missing');
}

$config = require $configPath;
$requiredToken = $config['import_token'] ?? '';

$rawBody = file_get_contents('php://input');
$data = json_decode($rawBody ?: '{}', true);
if (!is_array($data)) {
    fail_json(400, 'Invalid JSON body');
}

$providedToken = isset($data['token']) ? (string)$data['token'] : '';
if ($requiredToken === '' || $providedToken !== $requiredToken) {
    fail_json(403, 'Forbidden');
}

$name = normalize_text($data['name'] ?? null);
$description = normalize_text($data['description'] ?? null);
$url = normalize_text($data['url'] ?? null);
$imageUrl = normalize_text($data['image_url'] ?? null);
$genre = normalize_text($data['genre'] ?? null);
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

$selectedTagIds = [];
if (isset($data['tag_ids']) && is_array($data['tag_ids'])) {
    foreach ($data['tag_ids'] as $tagIdRaw) {
        $tagId = (int)$tagIdRaw;
        if ($tagId > 0) {
            $selectedTagIds[] = $tagId;
        }
    }
}
$selectedTagIds = array_values(array_unique($selectedTagIds));

$newTagNames = [];
if (isset($data['new_tags']) && is_array($data['new_tags'])) {
    foreach ($data['new_tags'] as $tagNameRaw) {
        $tagName = normalize_text($tagNameRaw);
        if ($tagName !== null) {
            $newTagNames[] = $tagName;
        }
    }
}

$price = null;
if (isset($data['price']) && trim((string)$data['price']) !== '') {
    if (!is_numeric($data['price'])) {
        fail_json(422, 'Price must be numeric');
    }
    $price = (float)$data['price'];
}
$priceCurrency = normalize_text($data['price_currency'] ?? null);
$offerUrl = normalize_text($data['offer_url'] ?? null);

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

    $pdo->beginTransaction();

    $schemaFlags = [
        'hasAudienceLabelsTable' => table_exists($pdo, 'audience_labels'),
        'hasOrganizationPlacesTable' => table_exists($pdo, 'organization_places'),
        'hasOrgCategory' => column_exists($pdo, 'organizations', 'category'),
        'hasOrgLogo' => column_exists($pdo, 'organizations', 'logo_url'),
        'hasOrgAudience' => column_exists($pdo, 'organizations', 'audience_label_id'),
        'hasOrgCity' => column_exists($pdo, 'organizations', 'city_id'),
        'hasEventAudience' => column_exists($pdo, 'events', 'audience_label_id'),
    ];

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

    if ($schemaFlags['hasEventAudience']) {
        $insEvent = $pdo->prepare(
            'INSERT INTO events (identifier, name, description, url, image_url, genre, keywords_text, event_status, attendance_mode, audience_label_id, place_id, city_id, start_datetime, end_datetime)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $insEvent->execute([
            $identifier,
            $name,
            $description,
            $url,
            $imageUrl,
            $genre,
            $keywordsText,
            $eventStatus,
            $attendanceMode,
            $eventAudienceLabelId,
            $placeId,
            $cityId,
            $startDateTime,
            $endDateTime,
        ]);
    } else {
        $insEvent = $pdo->prepare(
            'INSERT INTO events (identifier, name, description, url, image_url, genre, keywords_text, event_status, attendance_mode, place_id, city_id, start_datetime, end_datetime)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $insEvent->execute([
            $identifier,
            $name,
            $description,
            $url,
            $imageUrl,
            $genre,
            $keywordsText,
            $eventStatus,
            $attendanceMode,
            $placeId,
            $cityId,
            $startDateTime,
            $endDateTime,
        ]);
    }
    $eventId = (int)$pdo->lastInsertId();

    if ($organizationId > 0) {
        if ($schemaFlags['hasOrganizationPlacesTable']) {
            link_organization_place($pdo, $organizationId, $placeId);
        }
        $insEventOrg = $pdo->prepare('INSERT INTO event_organizations (event_id, organization_id, role) VALUES (?, ?, ?)');
        $insEventOrg->execute([$eventId, $organizationId, $organizationRole]);
    }

    if ($price !== null || $priceCurrency !== null || $offerUrl !== null) {
        $insOffer = $pdo->prepare('INSERT INTO offers (event_id, price, price_currency, url) VALUES (?, ?, ?, ?)');
        $insOffer->execute([$eventId, $price, $priceCurrency, $offerUrl]);
    }

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

    $pdo->commit();

    echo json_encode([
        'ok' => true,
        'event_id' => $eventId,
        'message' => 'Event created successfully',
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fail_json(500, 'Failed to create event');
}
