<?php
// admin-recurring-events.php - create, update, list, and delete recurring events.

require_once __DIR__ . '/lib/event_domain.php';
require_once __DIR__ . '/lib/prides_query.php';
require_once __DIR__ . '/lib/admin_auth.php';

header('Content-Type: application/json; charset=utf-8');

function recurring_fail_json(int $code, string $message): void
{
    http_response_code($code);
    echo json_encode(['error' => $message], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function recurring_normalize_text($value): ?string
{
    if ($value === null) {
        return null;
    }
    $trimmed = trim((string)$value);
    return $trimmed === '' ? null : $trimmed;
}

function recurring_parse_tag_ids($raw): array
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

function recurring_parse_new_tags($raw): array
{
    $out = [];
    if (!is_array($raw)) {
        return $out;
    }
    foreach ($raw as $tagNameRaw) {
        $tagName = recurring_normalize_text($tagNameRaw);
        if ($tagName !== null) {
            $out[] = $tagName;
        }
    }
    return $out;
}

function recurring_normalize_time($value): ?string
{
    $text = trim((string)$value);
    if ($text === '') {
        return null;
    }
    if (!preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $text)) {
        return null;
    }
    if (strlen($text) === 5) {
        $text .= ':00';
    }
    return $text;
}

function recurring_normalize_date($value): ?string
{
    $text = trim((string)$value);
    if ($text === '') {
        return null;
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $text)) {
        return null;
    }
    return $text;
}

function recurring_normalize_frequency($value): ?string
{
    $raw = strtolower(trim((string)$value));
    if ($raw === '') {
        return null;
    }
    $map = [
        'weekly' => 'Weekly',
        'fortnightly' => 'Fortnightly',
        'biweekly' => 'Fortnightly',
        'monthly' => 'Monthly',
        'p1w' => 'P1W',
        'p2w' => 'P2W',
        'p1m' => 'P1M',
    ];
    return $map[$raw] ?? null;
}

function recurring_parse_by_day($raw): array
{
    $allowed = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
    if (!is_array($raw)) {
        return [];
    }
    $out = [];
    foreach ($raw as $d) {
        $token = strtoupper(trim((string)$d));
        if (in_array($token, $allowed, true)) {
            $out[] = $token;
        }
    }
    return array_values(array_unique($out));
}

function recurring_find_or_create_tag(PDO $pdo, string $name): ?int
{
    $normalized = strtolower(trim($name));
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

function recurring_fetch_schema_flags(PDO $pdo): array
{
    return [
        'hasAudienceLabelsTable' => qc_table_exists($pdo, 'audience_labels'),
        'hasPridesTable' => qc_table_exists($pdo, 'prides'),
        'hasSchedulesTable' => qc_table_exists($pdo, 'schedules'),
        'hasScheduleByDayTable' => qc_table_exists($pdo, 'schedule_by_day'),
        'hasEventAudience' => qc_column_exists($pdo, 'events', 'audience_label_id'),
        'hasEventPride' => qc_column_exists($pdo, 'events', 'pride_id'),
    ];
}

function recurring_replace_event_organization(PDO $pdo, int $eventId, int $organizationId, ?string $organizationRole): void
{
    $pdo->prepare('DELETE FROM event_organizations WHERE event_id = ?')->execute([$eventId]);
    if ($organizationId <= 0) {
        return;
    }
    $ins = $pdo->prepare('INSERT INTO event_organizations (event_id, organization_id, role) VALUES (?, ?, ?)');
    $ins->execute([$eventId, $organizationId, $organizationRole]);
}

function recurring_replace_event_offer(PDO $pdo, int $eventId, $price, ?string $priceCurrency, ?string $offerUrl): void
{
    $pdo->prepare('DELETE FROM offers WHERE event_id = ?')->execute([$eventId]);
    if ($price === null && $priceCurrency === null && $offerUrl === null) {
        return;
    }
    $ins = $pdo->prepare('INSERT INTO offers (event_id, price, price_currency, url) VALUES (?, ?, ?, ?)');
    $ins->execute([$eventId, $price, $priceCurrency, $offerUrl]);
}

function recurring_replace_event_tags(PDO $pdo, int $eventId, array $selectedTagIds, array $newTagNames): void
{
    $pdo->prepare('DELETE FROM event_tags WHERE event_id = ?')->execute([$eventId]);
    $ins = $pdo->prepare('INSERT IGNORE INTO event_tags (event_id, tag_id) VALUES (?, ?)');
    foreach ($selectedTagIds as $tagId) {
        $ins->execute([$eventId, $tagId]);
    }
    foreach ($newTagNames as $tagName) {
        $tagId = recurring_find_or_create_tag($pdo, $tagName);
        if ($tagId !== null) {
            $ins->execute([$eventId, $tagId]);
        }
    }
}

function recurring_replace_schedule(PDO $pdo, array $schemaFlags, int $eventId, string $repeatFrequency, string $timezone, string $startTime, ?string $endTime, string $startDate, ?string $endDate, ?int $repeatCount, array $byDay): int
{
    if ($schemaFlags['hasSchedulesTable']) {
        $sel = $pdo->prepare('SELECT id FROM schedules WHERE event_id = ?');
        $sel->execute([$eventId]);
        $existingIds = array_map(static fn(array $r): int => (int)$r['id'], $sel->fetchAll());
        if (!empty($existingIds) && $schemaFlags['hasScheduleByDayTable']) {
            $in = implode(',', array_fill(0, count($existingIds), '?'));
            $delByDay = $pdo->prepare("DELETE FROM schedule_by_day WHERE schedule_id IN ($in)");
            $delByDay->execute($existingIds);
        }
        $pdo->prepare('DELETE FROM schedules WHERE event_id = ?')->execute([$eventId]);
    }

    $insSchedule = $pdo->prepare(
        'INSERT INTO schedules (event_id, repeat_frequency, schedule_timezone, start_time, end_time, start_date, end_date, repeat_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $insSchedule->execute([$eventId, $repeatFrequency, $timezone, $startTime, $endTime, $startDate, $endDate, $repeatCount]);
    $scheduleId = (int)$pdo->lastInsertId();

    if ($schemaFlags['hasScheduleByDayTable'] && !empty($byDay)) {
        $insByDay = $pdo->prepare('INSERT IGNORE INTO schedule_by_day (schedule_id, day_of_week) VALUES (?, ?)');
        foreach ($byDay as $day) {
            $insByDay->execute([$scheduleId, $day]);
        }
    }

    return $scheduleId;
}

function recurring_fetch_admin_events(PDO $pdo, array $schemaFlags, int $limit = 500): array
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
  e.city_id,
  e.place_id,
  {$selectAudience},
  {$selectPride},
  s.id AS schedule_id,
  s.repeat_frequency,
  s.schedule_timezone,
  s.start_time,
  s.end_time,
  s.start_date,
  s.end_date,
  s.repeat_count,
  sbd.by_day_csv,
  o.price,
  o.price_currency,
  o.url AS offer_url,
  eo.organization_id,
  eo.role AS organization_role,
  GROUP_CONCAT(DISTINCT et.tag_id ORDER BY et.tag_id SEPARATOR ',') AS tag_ids_csv
FROM events e
JOIN schedules s ON s.event_id = e.id
LEFT JOIN (
  SELECT schedule_id, GROUP_CONCAT(day_of_week ORDER BY FIELD(day_of_week, 'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU') SEPARATOR ',') AS by_day_csv
  FROM schedule_by_day
  GROUP BY schedule_id
) sbd ON sbd.schedule_id = s.id
LEFT JOIN offers o ON o.event_id = e.id
LEFT JOIN (
  SELECT event_id, MIN(organization_id) AS organization_id, MIN(role) AS role
  FROM event_organizations
  GROUP BY event_id
) eo ON eo.event_id = e.id
LEFT JOIN event_tags et ON et.event_id = e.id
GROUP BY
  e.id, e.identifier, e.name, e.description, e.url, e.image_url, e.genre, e.keywords_text,
  e.event_status, e.attendance_mode, e.city_id, e.place_id, event_audience_label_id, pride_id,
  s.id, s.repeat_frequency, s.schedule_timezone, s.start_time, s.end_time, s.start_date, s.end_date, s.repeat_count,
  sbd.by_day_csv, o.price, o.price_currency, o.url, eo.organization_id, eo.role
ORDER BY e.name ASC, s.start_date ASC
LIMIT " . max(1, min(2000, $limit));

    $rows = $pdo->query($sql)->fetchAll();
    return array_map(static function (array $row): array {
        $tagIds = [];
        if (!empty($row['tag_ids_csv'])) {
            $tagIds = array_map('intval', explode(',', (string)$row['tag_ids_csv']));
            $tagIds = array_values(array_filter($tagIds, static fn(int $id): bool => $id > 0));
        }
        $byDay = [];
        if (!empty($row['by_day_csv'])) {
            $byDay = array_values(array_unique(array_map('trim', explode(',', (string)$row['by_day_csv']))));
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
            'city_id' => isset($row['city_id']) ? (int)$row['city_id'] : 0,
            'place_id' => isset($row['place_id']) ? (int)$row['place_id'] : 0,
            'event_audience_label_id' => isset($row['event_audience_label_id']) ? (int)$row['event_audience_label_id'] : 0,
            'pride_id' => isset($row['pride_id']) ? (int)$row['pride_id'] : 0,
            'schedule_id' => isset($row['schedule_id']) ? (int)$row['schedule_id'] : 0,
            'repeat_frequency' => $row['repeat_frequency'],
            'schedule_timezone' => $row['schedule_timezone'],
            'start_time' => $row['start_time'],
            'end_time' => $row['end_time'],
            'start_date' => $row['start_date'],
            'end_date' => $row['end_date'],
            'repeat_count' => $row['repeat_count'] !== null ? (int)$row['repeat_count'] : null,
            'by_day' => $byDay,
            'price' => $row['price'],
            'price_currency' => $row['price_currency'],
            'offer_url' => $row['offer_url'],
            'organization_id' => isset($row['organization_id']) ? (int)$row['organization_id'] : 0,
            'organization_role' => $row['organization_role'],
            'tag_ids' => $tagIds,
        ];
    }, $rows);
}

$configPath = __DIR__ . '/../config/db.php';
if (!file_exists($configPath)) {
    recurring_fail_json(500, 'Server config missing');
}

$config = require $configPath;

$rawBody = file_get_contents('php://input');
$data = json_decode($rawBody ?: '{}', true);
if (!is_array($data)) {
    $data = [];
}

$providedToken = qc_admin_extract_token([$data['token'] ?? null]);
if (!qc_admin_token_is_valid($providedToken)) {
    recurring_fail_json(403, 'Forbidden');
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

    $schemaFlags = recurring_fetch_schema_flags($pdo);
    if (!$schemaFlags['hasSchedulesTable']) {
        recurring_fail_json(500, 'Recurring schedules table is missing');
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
        recurring_fail_json(405, 'Method not allowed');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        echo json_encode(['events' => recurring_fetch_admin_events($pdo, $schemaFlags)], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    $action = strtolower(trim((string)($data['action'] ?? 'save')));
    if ($action === '') {
        $action = 'save';
    }

    if ($action === 'list') {
        echo json_encode(['events' => recurring_fetch_admin_events($pdo, $schemaFlags)], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'delete') {
        $eventId = isset($data['id']) ? (int)$data['id'] : 0;
        if ($eventId <= 0) {
            recurring_fail_json(422, 'An event id is required');
        }

        $pdo->beginTransaction();
        $exists = $pdo->prepare('SELECT e.id FROM events e JOIN schedules s ON s.event_id = e.id WHERE e.id = ? LIMIT 1');
        $exists->execute([$eventId]);
        if (!$exists->fetch()) {
            recurring_fail_json(404, 'Recurring event not found');
        }

        $scheduleIds = $pdo->prepare('SELECT id FROM schedules WHERE event_id = ?');
        $scheduleIds->execute([$eventId]);
        $ids = array_map(static fn(array $r): int => (int)$r['id'], $scheduleIds->fetchAll());
        if (!empty($ids) && $schemaFlags['hasScheduleByDayTable']) {
            $in = implode(',', array_fill(0, count($ids), '?'));
            $delByDay = $pdo->prepare("DELETE FROM schedule_by_day WHERE schedule_id IN ($in)");
            $delByDay->execute($ids);
        }
        $pdo->prepare('DELETE FROM schedules WHERE event_id = ?')->execute([$eventId]);
        $pdo->prepare('DELETE FROM event_tags WHERE event_id = ?')->execute([$eventId]);
        $pdo->prepare('DELETE FROM event_organizations WHERE event_id = ?')->execute([$eventId]);
        $pdo->prepare('DELETE FROM offers WHERE event_id = ?')->execute([$eventId]);
        $pdo->prepare('DELETE FROM events WHERE id = ?')->execute([$eventId]);

        $pdo->commit();
        echo json_encode([
            'ok' => true,
            'deleted_id' => $eventId,
            'events' => recurring_fetch_admin_events($pdo, $schemaFlags),
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action !== 'save') {
        recurring_fail_json(422, 'Unknown action');
    }

    $eventId = isset($data['id']) ? (int)$data['id'] : 0;
    $isUpdate = $eventId > 0;

    $name = recurring_normalize_text($data['name'] ?? null);
    $description = recurring_normalize_text($data['description'] ?? null);
    $url = recurring_normalize_text($data['url'] ?? null);
    $imageUrl = recurring_normalize_text($data['image_url'] ?? null);
    $genre = normalize_event_genre_for_write($data['genre'] ?? null);
    $keywordsText = recurring_normalize_text($data['keywords_text'] ?? null);
    $identifier = recurring_normalize_text($data['identifier'] ?? null);
    $eventStatus = recurring_normalize_text($data['event_status'] ?? null);
    $attendanceMode = recurring_normalize_text($data['attendance_mode'] ?? null);

    $cityId = isset($data['city_id']) ? (int)$data['city_id'] : 0;
    $placeId = isset($data['place_id']) ? (int)$data['place_id'] : 0;
    $organizationId = isset($data['organization_id']) ? (int)$data['organization_id'] : 0;
    $organizationRole = recurring_normalize_text($data['organization_role'] ?? null);
    $eventAudienceLabelId = isset($data['event_audience_label_id']) ? (int)$data['event_audience_label_id'] : 0;
    $prideId = isset($data['pride_id']) ? (int)$data['pride_id'] : 0;

    $repeatFrequency = recurring_normalize_frequency($data['repeat_frequency'] ?? null);
    $scheduleTimezone = recurring_normalize_text($data['schedule_timezone'] ?? null) ?? 'Europe/London';
    $startTime = recurring_normalize_time($data['start_time'] ?? null);
    $endTime = recurring_normalize_time($data['end_time'] ?? null);
    $startDate = recurring_normalize_date($data['start_date'] ?? null);
    $endDate = recurring_normalize_date($data['end_date'] ?? null);
    $repeatCount = isset($data['repeat_count']) && trim((string)$data['repeat_count']) !== '' ? (int)$data['repeat_count'] : null;
    $byDay = recurring_parse_by_day($data['by_day'] ?? []);

    $selectedTagIds = recurring_parse_tag_ids($data['tag_ids'] ?? []);
    $newTagNames = recurring_parse_new_tags($data['new_tags'] ?? []);

    $price = null;
    if (isset($data['price']) && trim((string)$data['price']) !== '') {
        if (!is_numeric($data['price'])) {
            recurring_fail_json(422, 'Price must be numeric');
        }
        $price = (float)$data['price'];
    }
    $priceCurrency = recurring_normalize_text($data['price_currency'] ?? null);
    $offerUrl = recurring_normalize_text($data['offer_url'] ?? null);

    if ($name === null) {
        recurring_fail_json(422, 'Event name is required');
    }
    if (($data['genre'] ?? null) !== null && $genre === null) {
        recurring_fail_json(422, 'Category is invalid');
    }
    if ($cityId <= 0) {
        recurring_fail_json(422, 'City is required');
    }
    if ($placeId <= 0) {
        recurring_fail_json(422, 'Place is required');
    }
    if ($repeatFrequency === null) {
        recurring_fail_json(422, 'Repeat frequency is required');
    }
    if ($startTime === null) {
        recurring_fail_json(422, 'Start time is required');
    }
    if ($startDate === null) {
        recurring_fail_json(422, 'Start date is required');
    }
    if ($endDate !== null && $endDate < $startDate) {
        recurring_fail_json(422, 'End date must be on or after start date');
    }
    if ($repeatCount !== null && $repeatCount <= 0) {
        recurring_fail_json(422, 'Repeat count must be a positive integer');
    }
    if (empty($byDay)) {
        recurring_fail_json(422, 'At least one day of week is required');
    }
    if (!$schemaFlags['hasScheduleByDayTable']) {
        recurring_fail_json(500, 'Schedule by day table is missing');
    }

    $pdo->beginTransaction();

    if ($isUpdate) {
        $checkEvent = $pdo->prepare('SELECT id FROM events WHERE id = ?');
        $checkEvent->execute([$eventId]);
        if (!$checkEvent->fetch()) {
            recurring_fail_json(404, 'Event not found');
        }
    }

    $checkCity = $pdo->prepare('SELECT id FROM cities WHERE id = ?');
    $checkCity->execute([$cityId]);
    if (!$checkCity->fetch()) {
        recurring_fail_json(422, 'Selected city does not exist');
    }

    $checkPlace = $pdo->prepare('SELECT id FROM places WHERE id = ?');
    $checkPlace->execute([$placeId]);
    if (!$checkPlace->fetch()) {
        recurring_fail_json(422, 'Selected place does not exist');
    }

    if ($organizationId > 0) {
        $checkOrg = $pdo->prepare('SELECT id FROM organizations WHERE id = ?');
        $checkOrg->execute([$organizationId]);
        if (!$checkOrg->fetch()) {
            recurring_fail_json(422, 'Selected organization does not exist');
        }
    }

    if ($eventAudienceLabelId > 0 && $schemaFlags['hasAudienceLabelsTable']) {
        $checkAudience = $pdo->prepare('SELECT id FROM audience_labels WHERE id = ?');
        $checkAudience->execute([$eventAudienceLabelId]);
        if (!$checkAudience->fetch()) {
            recurring_fail_json(422, 'Selected event audience label does not exist');
        }
    } else {
        $eventAudienceLabelId = null;
    }

    if ($prideId > 0) {
        if (!$schemaFlags['hasPridesTable'] || !$schemaFlags['hasEventPride']) {
            recurring_fail_json(422, 'Prides support is not available in this database schema yet');
        }
        $checkPride = $pdo->prepare('SELECT id FROM prides WHERE id = ?');
        $checkPride->execute([$prideId]);
        if (!$checkPride->fetch()) {
            recurring_fail_json(422, 'Selected pride does not exist');
        }
    } else {
        $prideId = null;
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
    $eventValues = array_merge($eventValues, [$placeId, $cityId, null, null]);

    if ($isUpdate) {
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

    recurring_replace_event_organization($pdo, $eventId, $organizationId, $organizationRole);
    recurring_replace_event_offer($pdo, $eventId, $price, $priceCurrency, $offerUrl);
    recurring_replace_event_tags($pdo, $eventId, $selectedTagIds, $newTagNames);
    recurring_replace_schedule(
        $pdo,
        $schemaFlags,
        $eventId,
        $repeatFrequency,
        $scheduleTimezone,
        $startTime,
        $endTime,
        $startDate,
        $endDate,
        $repeatCount,
        $byDay
    );

    $pdo->commit();

    echo json_encode([
        'ok' => true,
        'event_id' => $eventId,
        'message' => ($isUpdate ? 'Recurring event saved successfully' : 'Recurring event created successfully'),
        'events' => recurring_fetch_admin_events($pdo, $schemaFlags),
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    recurring_fail_json(500, 'Failed to manage recurring event: ' . $e->getMessage());
}

