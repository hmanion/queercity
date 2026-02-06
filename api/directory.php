<?php
// directory.php - recurring events JSON (Schema.org-like) from MySQL

$DB_HOST = 'db5019616289.hosting-data.io';
$DB_PORT = 3306;
$DB_NAME = 'dbs15283861';
$DB_USER = 'dbu4246002';
$DB_PASS = 'rancEb-tuktor-kyfqi4';

$pdo = new PDO(
    "mysql:host=$DB_HOST;port=$DB_PORT;dbname=$DB_NAME;charset=utf8mb4",
    $DB_USER,
    $DB_PASS,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
);

$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 0;
$limit = ($limit > 0) ? min($limit, 2000) : 0;
$genre = isset($_GET['genre']) ? $_GET['genre'] : null; // comma-separated

$where = [];
$params = [];
if ($genre) {
    $genres = array_filter(array_map('trim', explode(',', $genre)));
    if (!empty($genres)) {
        $placeholders = implode(',', array_fill(0, count($genres), '?'));
        $where[] = "e.genre IN ($placeholders)";
        $params = array_merge($params, $genres);
    }
}

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
  p.name AS place_name,
  a.street_address,
  a.address_locality,
  a.postal_code,
  a.address_country,
  s.id AS schedule_id,
  s.repeat_frequency,
  s.schedule_timezone,
  s.start_time,
  s.end_time,
  s.start_date,
  s.end_date,
  s.repeat_count
FROM events e
JOIN schedules s ON s.event_id = e.id
LEFT JOIN places p ON e.place_id = p.id
LEFT JOIN postal_addresses a ON p.address_id = a.id
";

if (!empty($where)) {
    $sql .= " WHERE " . implode(" AND ", $where);
}

$sql .= " ORDER BY e.name ASC";

if ($limit > 0) {
    $sql .= " LIMIT " . (int)$limit;
}

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

// Collect schedule ids for byDay
$schedule_ids = array_values(array_unique(array_map(fn($r) => (int)$r['schedule_id'], $rows)));
$by_day = [];
if (!empty($schedule_ids)) {
    $in = implode(',', array_fill(0, count($schedule_ids), '?'));
    $stmt = $pdo->prepare("SELECT schedule_id, day_of_week FROM schedule_by_day WHERE schedule_id IN ($in)");
    $stmt->execute($schedule_ids);
    foreach ($stmt->fetchAll() as $d) {
        $sid = (int)$d['schedule_id'];
        if (!isset($by_day[$sid])) $by_day[$sid] = [];
        $by_day[$sid][] = $d['day_of_week'];
    }
}

$day_map = [
    'MO' => 'https://schema.org/Monday',
    'TU' => 'https://schema.org/Tuesday',
    'WE' => 'https://schema.org/Wednesday',
    'TH' => 'https://schema.org/Thursday',
    'FR' => 'https://schema.org/Friday',
    'SA' => 'https://schema.org/Saturday',
    'SU' => 'https://schema.org/Sunday',
];

$out = [];
foreach ($rows as $r) {
    $sid = (int)$r['schedule_id'];
    $days = $by_day[$sid] ?? [];
    $days = array_values(array_unique($days));
    $byDay = null;
    if (count($days) === 1 && isset($day_map[$days[0]])) {
        $byDay = $day_map[$days[0]];
    } elseif (count($days) > 1) {
        $byDay = array_map(fn($d) => $day_map[$d] ?? $d, $days);
    }

    $item = [
        '@context' => 'https://schema.org',
        '@type' => 'Event',
        'identifier' => $r['identifier'],
        'name' => $r['name'],
        'eventStatus' => $r['event_status'],
        'eventAttendanceMode' => $r['attendance_mode'],
        'url' => $r['url'],
        'description' => $r['description'],
        'image' => $r['image_url'],
        'genre' => $r['genre'],
        'keywords' => $r['keywords_text'],
        'location' => [
            '@type' => 'Place',
            'name' => $r['place_name'],
            'address' => [
                '@type' => 'PostalAddress',
                'streetAddress' => $r['street_address'],
                'addressLocality' => $r['address_locality'],
                'postalCode' => $r['postal_code'],
                'addressCountry' => $r['address_country'],
            ]
        ],
        'eventSchedule' => [
            '@type' => 'Schedule',
            'repeatFrequency' => $r['repeat_frequency'],
            'scheduleTimezone' => $r['schedule_timezone'],
            'startTime' => $r['start_time'],
            'endTime' => $r['end_time'],
            'startDate' => $r['start_date'],
            'endDate' => $r['end_date'],
            'repeatCount' => $r['repeat_count'],
            'byDay' => $byDay,
        ]
    ];

    $out[] = $item;
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode($out, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
