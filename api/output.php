<?php
// output.php - one-off events JSON (Schema.org-like) from MySQL

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

$from = isset($_GET['from']) ? $_GET['from'] : null; // YYYY-MM-DD
$to = isset($_GET['to']) ? $_GET['to'] : null;       // YYYY-MM-DD
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 0;
$limit = ($limit > 0) ? min($limit, 2000) : 0;

$where = ["e.start_datetime IS NOT NULL"];
$params = [];

if ($from) {
    $from_dt = $from . " 00:00:00";
    $where[] = "(e.end_datetime >= ? OR (e.end_datetime IS NULL AND e.start_datetime >= ?))";
    $params[] = $from_dt;
    $params[] = $from_dt;
}
if ($to) {
    $to_dt = $to . " 23:59:59";
    $where[] = "e.start_datetime <= ?";
    $params[] = $to_dt;
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
  e.start_datetime,
  e.end_datetime,
  p.name AS place_name,
  a.street_address,
  a.address_locality,
  a.postal_code,
  a.address_country
FROM events e
LEFT JOIN places p ON e.place_id = p.id
LEFT JOIN postal_addresses a ON p.address_id = a.id
WHERE " . implode(" AND ", $where) . "
ORDER BY e.start_datetime ASC
";

if ($limit > 0) {
    $sql .= " LIMIT " . (int)$limit;
}

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

// Fetch offers in one query
$event_ids = array_map(fn($r) => (int)$r['id'], $rows);
$offers_by_event = [];
if (!empty($event_ids)) {
    $in = implode(',', array_fill(0, count($event_ids), '?'));
    $stmt = $pdo->prepare("SELECT event_id, price, price_currency, url FROM offers WHERE event_id IN ($in)");
    $stmt->execute($event_ids);
    foreach ($stmt->fetchAll() as $o) {
        $eid = (int)$o['event_id'];
        if (!isset($offers_by_event[$eid])) {
            $offers_by_event[$eid] = $o; // take first offer
        }
    }
}

$out = [];
foreach ($rows as $r) {
    $item = [
        '@context' => 'https://schema.org',
        '@type' => 'Event',
        'identifier' => $r['identifier'],
        'name' => $r['name'],
        'eventStatus' => $r['event_status'],
        'eventAttendanceMode' => $r['attendance_mode'],
        'startDate' => $r['start_datetime'] ? str_replace(' ', 'T', $r['start_datetime']) : null,
        'endDate' => $r['end_datetime'] ? str_replace(' ', 'T', $r['end_datetime']) : null,
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
        ]
    ];

    $eid = (int)$r['id'];
    if (isset($offers_by_event[$eid])) {
        $offer = $offers_by_event[$eid];
        $item['offers'] = [
            '@type' => 'Offer',
            'price' => $offer['price'],
            'priceCurrency' => $offer['price_currency'],
            'url' => $offer['url']
        ];
    }

    $out[] = $item;
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode($out, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
