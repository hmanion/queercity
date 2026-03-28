<?php
// directory.php - recurring events JSON (Schema.org-like) from MySQL

$config = require __DIR__ . '/../config/db.php';

function normalize_event_genre_label($value): ?string {
    $text = trim((string)($value ?? ''));
    if ($text === '') return null;
    $token = strtolower(preg_replace('/[^a-z0-9]+/i', '', $text));
    $map = [
        'activity' => 'Active',
        'activities' => 'Active',
        'active' => 'Active',
        'arts' => 'Arts',
        'art' => 'Arts',
        'club' => 'Music',
        'clubs' => 'Music',
        'music' => 'Music',
        'celebration' => 'Celebration',
        'celebrations' => 'Celebration',
        'life' => 'Life',
        'sex' => 'Sex',
        'sexy' => 'Sex',
        'social' => 'Social',
        'socials' => 'Social',
    ];
    return $map[$token] ?? $text;
}

function genre_filter_variants($value): array {
    $normalized = normalize_event_genre_label($value);
    if ($normalized === null) return [];
    $variants = [$normalized];
    if ($normalized === 'Active') $variants[] = 'Activity';
    if ($normalized === 'Music') $variants[] = 'Club';
    if ($normalized === 'Sex') $variants[] = 'Sexy';
    return array_values(array_unique($variants));
}

$pdo = new PDO(
    "mysql:host={$config['host']};port={$config['port']};dbname={$config['name']};charset=utf8mb4",
    $config['user'],
    $config['pass'],
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
        $expanded = [];
        foreach ($genres as $g) {
            foreach (genre_filter_variants($g) as $variant) {
                $expanded[] = $variant;
            }
        }
        $expanded = array_values(array_unique($expanded));
        $placeholders = implode(',', array_fill(0, count($expanded), '?'));
        $where[] = "e.genre IN ($placeholders)";
        $params = array_merge($params, $expanded);
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
        'genre' => normalize_event_genre_label($r['genre']),
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
