<?php

function normalize_event_genre_label($value): ?string
{
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

function fetch_one_off_events(PDO $pdo, ?string $fromDate, ?string $toDate, int $limit = 0): array
{
    $limit = ($limit > 0) ? min($limit, 2000) : 0;

    $where = ["e.start_datetime IS NOT NULL"];
    $params = [];

    if ($fromDate) {
        $from_dt = $fromDate . " 00:00:00";
        $where[] = "(e.end_datetime >= ? OR (e.end_datetime IS NULL AND e.start_datetime >= ?))";
        $params[] = $from_dt;
        $params[] = $from_dt;
    }
    if ($toDate) {
        $to_dt = $toDate . " 23:59:59";
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

    $event_ids = array_map(fn($r) => (int)$r['id'], $rows);
    $offers_by_event = [];
    if (!empty($event_ids)) {
        $in = implode(',', array_fill(0, count($event_ids), '?'));
        $stmt = $pdo->prepare("SELECT event_id, price, price_currency, url FROM offers WHERE event_id IN ($in)");
        $stmt->execute($event_ids);
        foreach ($stmt->fetchAll() as $o) {
            $eid = (int)$o['event_id'];
            if (!isset($offers_by_event[$eid])) {
                $offers_by_event[$eid] = $o;
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

    return $out;
}
