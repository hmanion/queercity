<?php
// One-off importer for Queer City JSON-LD into MySQL (Ionos shared hosting compatible)
// Usage: upload this file to your web root or scripts/ and run once in a browser or via CLI: php import_json_to_mysql.php
// IMPORTANT: delete this file after running.

// ====== CONFIG ======
$DB_HOST = 'localhost';        // Ionos typically allows local DB access via localhost from the web host
$DB_PORT = 3306;
$DB_NAME = 'dbs15283861';
$DB_USER = 'dbu4246002';
$DB_PASS = 'rancEb-tuktor-kyfqi4';

$CITY_NAME = 'Manchester';
$CITY_SLUG = 'manchester';
$CITY_REGION = 'Greater Manchester';
$CITY_COUNTRY_CODE = 'GB';
$CITY_TIMEZONE = 'Europe/London';

$OUTPUT_JSON = __DIR__ . '/../output.json';
$DIRECTORY_JSON = __DIR__ . '/../directory.json';

$IMPORT_TAGS = true; // set false if you don't want keywords -> tags

// ====== HELPERS ======
function iso_to_mysql_datetime($value) {
    if (!$value || !is_string($value)) return null;
    // Accept date-only or datetime; normalize to 'Y-m-d H:i:s'
    if (preg_match('/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}:\d{2}))?/', $value, $m)) {
        $date = $m[1];
        $time = isset($m[2]) ? $m[2] : '00:00:00';
        return $date . ' ' . $time;
    }
    return null;
}

function normalize_str($v) {
    if ($v === null) return '';
    return trim((string)$v);
}

function split_keywords($v) {
    if ($v === null) return [];
    if (is_array($v)) {
        $out = [];
        foreach ($v as $x) {
            $x = trim(strtolower((string)$x));
            if ($x !== '') $out[] = $x;
        }
        return $out;
    }
    if (!is_string($v)) return [];
    $parts = array_map('trim', explode(',', $v));
    $parts = array_filter($parts, fn($x) => $x !== '');
    return array_values(array_map('strtolower', $parts));
}

function get_offers($event) {
    if (!isset($event['offers'])) return [];
    $o = $event['offers'];
    if (is_array($o) && array_is_list($o)) return array_filter($o, 'is_array');
    if (is_array($o)) return [$o];
    return [];
}

function extract_by_day($value) {
    if ($value === null) return [];
    $values = is_array($value) ? $value : [$value];
    $map = [
        'Monday' => 'MO','Tuesday' => 'TU','Wednesday' => 'WE','Thursday' => 'TH',
        'Friday' => 'FR','Saturday' => 'SA','Sunday' => 'SU'
    ];
    $out = [];
    foreach ($values as $v) {
        if (!$v) continue;
        $v = (string)$v;
        if (preg_match('/schema\.org\/(\w+)$/', $v, $m) && isset($map[$m[1]])) {
            $out[] = $map[$m[1]];
            continue;
        }
        if (isset($map[$v])) { $out[] = $map[$v]; continue; }
        if (in_array($v, $map, true)) { $out[] = $v; continue; }
    }
    $out = array_values(array_unique($out));
    sort($out);
    return $out;
}

function load_json($path) {
    if (!file_exists($path)) throw new Exception("Missing file: $path");
    $raw = file_get_contents($path);
    $data = json_decode($raw, true);
    if (!is_array($data)) throw new Exception("Invalid JSON: $path");
    return $data;
}

// ====== MAIN ======
$dsn = "mysql:host=$DB_HOST;port=$DB_PORT;dbname=$DB_NAME;charset=utf8mb4";
$pdo = new PDO($dsn, $DB_USER, $DB_PASS, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$pdo->beginTransaction();

try {
    // Ensure city
    $stmt = $pdo->prepare("SELECT id FROM cities WHERE slug = ?");
    $stmt->execute([$CITY_SLUG]);
    $row = $stmt->fetch();
    if ($row) {
        $city_id = (int)$row['id'];
    } else {
        $stmt = $pdo->prepare("INSERT INTO cities (name, region, country_code, timezone, slug) VALUES (?,?,?,?,?)");
        $stmt->execute([$CITY_NAME, $CITY_REGION, $CITY_COUNTRY_CODE, $CITY_TIMEZONE, $CITY_SLUG]);
        $city_id = (int)$pdo->lastInsertId();
    }

    $address_cache = [];
    $place_cache = [];
    $tag_cache = [];

    $get_address = $pdo->prepare("SELECT id FROM postal_addresses WHERE street_address <=> ? AND address_locality <=> ? AND postal_code <=> ? AND address_country <=> ?");
    $ins_address = $pdo->prepare("INSERT INTO postal_addresses (street_address, address_locality, postal_code, address_country) VALUES (?,?,?,?)");

    $get_place = $pdo->prepare("SELECT id FROM places WHERE name <=> ? AND address_id <=> ?");
    $ins_place = $pdo->prepare("INSERT INTO places (name, address_id, city_id) VALUES (?,?,?)");

    $upsert_event = $pdo->prepare(
        "INSERT INTO events (identifier,name,description,url,image_url,genre,keywords_text,event_status,attendance_mode,place_id,city_id,start_datetime,end_datetime)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           name=VALUES(name), description=VALUES(description), url=VALUES(url), image_url=VALUES(image_url),
           genre=VALUES(genre), keywords_text=VALUES(keywords_text), event_status=VALUES(event_status), attendance_mode=VALUES(attendance_mode),
           place_id=VALUES(place_id), city_id=VALUES(city_id), start_datetime=VALUES(start_datetime), end_datetime=VALUES(end_datetime)"
    );
    $get_event_id = $pdo->prepare("SELECT id FROM events WHERE identifier=?");

    $del_offers = $pdo->prepare("DELETE FROM offers WHERE event_id=?");
    $sel_schedules = $pdo->prepare("SELECT id FROM schedules WHERE event_id=?");
    $del_schedule_by_day = $pdo->prepare("DELETE FROM schedule_by_day WHERE schedule_id=?");
    $del_schedules = $pdo->prepare("DELETE FROM schedules WHERE id=?");

    $ins_offer = $pdo->prepare("INSERT INTO offers (event_id, price, price_currency, url) VALUES (?,?,?,?)");

    $ins_schedule = $pdo->prepare("INSERT INTO schedules (event_id, repeat_frequency, schedule_timezone, start_time, end_time, start_date, end_date, repeat_count)
                                   VALUES (?,?,?,?,?,?,?,?)");
    $ins_schedule_day = $pdo->prepare("INSERT IGNORE INTO schedule_by_day (schedule_id, day_of_week) VALUES (?,?)");

    $get_tag = $pdo->prepare("SELECT id FROM tags WHERE name=?");
    $ins_tag = $pdo->prepare("INSERT INTO tags (name) VALUES (?)");
    $ins_event_tag = $pdo->prepare("INSERT IGNORE INTO event_tags (event_id, tag_id) VALUES (?,?)");

    $process_event = function($ev, $is_recurring) use (
        $pdo, $city_id, $address_cache, $place_cache, $tag_cache,
        $get_address, $ins_address, $get_place, $ins_place,
        $upsert_event, $get_event_id, $del_offers, $sel_schedules, $del_schedule_by_day, $del_schedules,
        $ins_offer, $ins_schedule, $ins_schedule_day, $get_tag, $ins_tag, $ins_event_tag, $IMPORT_TAGS
    ) {
        // location -> place
        $loc = isset($ev['location']) && is_array($ev['location']) ? $ev['location'] : [];
        $loc_name = normalize_str($loc['name'] ?? null);
        $addr = isset($loc['address']) && is_array($loc['address']) ? $loc['address'] : [];

        $street = normalize_str($addr['streetAddress'] ?? null);
        $locality = normalize_str($addr['addressLocality'] ?? null);
        $postal = normalize_str($addr['postalCode'] ?? null);
        $country = normalize_str($addr['addressCountry'] ?? null);

        $addr_key = $street . '|' . $locality . '|' . $postal . '|' . $country;
        if (isset($address_cache[$addr_key])) {
            $address_id = $address_cache[$addr_key];
        } else {
            $get_address->execute([$street ?: null, $locality ?: null, $postal ?: null, $country ?: null]);
            $row = $get_address->fetch();
            if ($row) {
                $address_id = (int)$row['id'];
            } else {
                $ins_address->execute([$street ?: null, $locality ?: null, $postal ?: null, $country ?: null]);
                $address_id = (int)$pdo->lastInsertId();
            }
            $address_cache[$addr_key] = $address_id;
        }

        $place_key = $loc_name . '|' . $address_id;
        if (isset($place_cache[$place_key])) {
            $place_id = $place_cache[$place_key];
        } else {
            $get_place->execute([$loc_name ?: null, $address_id ?: null]);
            $row = $get_place->fetch();
            if ($row) {
                $place_id = (int)$row['id'];
            } else {
                $ins_place->execute([$loc_name ?: null, $address_id ?: null, $city_id]);
                $place_id = (int)$pdo->lastInsertId();
            }
            $place_cache[$place_key] = $place_id;
        }

        $identifier = normalize_str($ev['identifier'] ?? null) ?: null;
        $name = normalize_str($ev['name'] ?? '');
        $description = $ev['description'] ?? null;
        $url = $ev['url'] ?? null;
        $image = $ev['image'] ?? null;
        $genre = $ev['genre'] ?? null;
        $keywords = $ev['keywords'] ?? null;
        $event_status = $ev['eventStatus'] ?? null;
        $attendance_mode = $ev['eventAttendanceMode'] ?? null;
        $start_dt = iso_to_mysql_datetime($ev['startDate'] ?? null);
        $end_dt = iso_to_mysql_datetime($ev['endDate'] ?? null);

        $upsert_event->execute([
            $identifier, $name, $description, $url, $image, $genre, $keywords,
            $event_status, $attendance_mode, $place_id, $city_id, $start_dt, $end_dt
        ]);

        $event_id = null;
        if ($identifier) {
            $get_event_id->execute([$identifier]);
            $row = $get_event_id->fetch();
            $event_id = $row ? (int)$row['id'] : null;
        }
        if (!$event_id) {
            $event_id = (int)$pdo->lastInsertId();
        }

        // clear offers + schedules for idempotency
        $del_offers->execute([$event_id]);
        $sel_schedules->execute([$event_id]);
        $sched_rows = $sel_schedules->fetchAll();
        foreach ($sched_rows as $r) {
            $sid = (int)$r['id'];
            $del_schedule_by_day->execute([$sid]);
            $del_schedules->execute([$sid]);
        }

        // offers
        foreach (get_offers($ev) as $offer) {
            $ins_offer->execute([
                $event_id,
                $offer['price'] ?? null,
                $offer['priceCurrency'] ?? null,
                $offer['url'] ?? null
            ]);
        }

        // tags
        if ($IMPORT_TAGS) {
            foreach (split_keywords($keywords) as $tag) {
                if (isset($tag_cache[$tag])) {
                    $tag_id = $tag_cache[$tag];
                } else {
                    $get_tag->execute([$tag]);
                    $row = $get_tag->fetch();
                    if ($row) {
                        $tag_id = (int)$row['id'];
                    } else {
                        $ins_tag->execute([$tag]);
                        $tag_id = (int)$pdo->lastInsertId();
                    }
                    $tag_cache[$tag] = $tag_id;
                }
                $ins_event_tag->execute([$event_id, $tag_id]);
            }
        }

        // schedule (recurring only)
        if ($is_recurring && isset($ev['eventSchedule']) && is_array($ev['eventSchedule'])) {
            $sched = $ev['eventSchedule'];
            $repeat_frequency = $sched['repeatFrequency'] ?? null;
            if ($repeat_frequency) {
                $ins_schedule->execute([
                    $event_id,
                    $repeat_frequency,
                    $sched['scheduleTimezone'] ?? null,
                    $sched['startTime'] ?? null,
                    $sched['endTime'] ?? null,
                    $sched['startDate'] ?? null,
                    $sched['endDate'] ?? null,
                    $sched['repeatCount'] ?? null,
                ]);
                $schedule_id = (int)$pdo->lastInsertId();
                foreach (extract_by_day($sched['byDay'] ?? null) as $day) {
                    $ins_schedule_day->execute([$schedule_id, $day]);
                }
            }
        }
    };

    $output_events = load_json($GLOBALS['OUTPUT_JSON']);
    foreach ($output_events as $ev) {
        if (!is_array($ev)) continue;
        $process_event($ev, false);
    }

    $directory_events = load_json($GLOBALS['DIRECTORY_JSON']);
    foreach ($directory_events as $ev) {
        if (!is_array($ev)) continue;
        $process_event($ev, true);
    }

    $pdo->commit();
    echo "Import complete\n";
} catch (Exception $e) {
    $pdo->rollBack();
    echo "ERROR: " . $e->getMessage() . "\n";
    http_response_code(500);
    exit(1);
}
