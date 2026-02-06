<?php
// Import partner CSV from a directory (expects exactly one .csv file) into MySQL.
// Skips matched events and logs audit rows. Deletes CSV after successful import.
// Upload this script into: harrymanion.co.uk/queercity/csvimport (same folder as the CSV).
// Run it once via browser, then delete this script.

// ====== CONFIG ======
$DB_HOST = 'db5019616289.hosting-data.io';
$DB_PORT = 3306;
$DB_NAME = 'dbs15283861';
$DB_USER = 'dbu4246002';
$DB_PASS = 'rancEb-tuktor-kyfqi4';

$CITY_NAME = 'Manchester';
$CITY_SLUG = 'manchester';
$CITY_REGION = 'Greater Manchester';
$CITY_COUNTRY_CODE = 'GB';
$CITY_TIMEZONE = 'Europe/London';

$CSV_DIR = __DIR__; // directory containing the CSV (and this script)
$DELETE_CSV_AFTER_SUCCESS = true;
$REQUIRED_TOKEN = 'REPLACE_WITH_SECRET_TOKEN';

// ====== HELPERS ======
function iso_to_mysql_datetime($date, $time) {
    $date = trim((string)$date);
    $time = trim((string)$time);
    if ($date === '') return null;
    if ($time === '') $time = '00:00:00';
    if (strlen($time) === 5) $time .= ':00';
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) return null;
    if (!preg_match('/^\d{2}:\d{2}:\d{2}$/', $time)) return null;
    return $date . ' ' . $time;
}

function normalize_str($v) {
    return $v === null ? '' : trim((string)$v);
}

function split_tags($v) {
    if ($v === null) return [];
    $parts = array_map('trim', explode(';', (string)$v));
    $parts = array_filter($parts, fn($x) => $x !== '');
    return array_values(array_map('strtolower', $parts));
}

function parse_price($v) {
    if ($v === null) return null;
    preg_match_all('/\d+(?:\.\d+)?/', (string)$v, $m);
    if (empty($m[0])) return null;
    return (float)$m[0][0];
}

function find_single_csv($dir) {
    $files = glob($dir . '/*.csv');
    if (!$files || count($files) === 0) {
        throw new Exception('No CSV file found in ' . $dir);
    }
    if (count($files) > 1) {
        throw new Exception('More than one CSV file found; please leave only one in the folder.');
    }
    return $files[0];
}

// ====== MAIN ======
$provided = $_GET['token'] ?? $_POST['token'] ?? '';
if ($REQUIRED_TOKEN === 'REPLACE_WITH_SECRET_TOKEN' || $provided !== $REQUIRED_TOKEN) {
    http_response_code(403);
    echo "Forbidden\\n";
    exit(1);
}

$dsn = "mysql:host=$DB_HOST;port=$DB_PORT;dbname=$DB_NAME;charset=utf8mb4";
$pdo = new PDO($dsn, $DB_USER, $DB_PASS, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$pdo->beginTransaction();

try {
    $csv_path = find_single_csv($CSV_DIR);

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

    // Start audit run
    $stmt = $pdo->prepare("INSERT INTO import_runs (source) VALUES (?)");
    $stmt->execute([basename($csv_path)]);
    $run_id = (int)$pdo->lastInsertId();

    $log_row = $pdo->prepare("INSERT INTO import_rows (run_id, source_event_id, action, reason) VALUES (?,?,?,?)");

    $get_address = $pdo->prepare("SELECT id FROM postal_addresses WHERE street_address <=> ? AND address_locality <=> ? AND postal_code <=> ? AND address_country <=> ?");
    $ins_address = $pdo->prepare("INSERT INTO postal_addresses (street_address, address_locality, postal_code, address_country) VALUES (?,?,?,?)");

    $get_place = $pdo->prepare("SELECT id FROM places WHERE name <=> ? AND address_id <=> ?");
    $ins_place = $pdo->prepare("INSERT INTO places (name, address_id, city_id) VALUES (?,?,?)");

    $upsert_event = $pdo->prepare(
        "INSERT INTO events (identifier,name,description,url,image_url,genre,keywords_text,event_status,attendance_mode,place_id,city_id,start_datetime,end_datetime)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"
    );

    $find_event_id = $pdo->prepare("SELECT id FROM events WHERE identifier=?");
    $find_event_url = $pdo->prepare("SELECT id FROM events WHERE url=?");
    $find_event_fuzzy = $pdo->prepare("SELECT id FROM events WHERE name=? AND start_datetime=? AND place_id=?");

    $ins_offer = $pdo->prepare("INSERT INTO offers (event_id, price, price_currency, url) VALUES (?,?,?,?)");

    $get_tag = $pdo->prepare("SELECT id FROM tags WHERE name=?");
    $ins_tag = $pdo->prepare("INSERT INTO tags (name) VALUES (?)");
    $ins_event_tag = $pdo->prepare("INSERT IGNORE INTO event_tags (event_id, tag_id) VALUES (?,?)");

    $address_cache = [];
    $place_cache = [];
    $tag_cache = [];

    $handle = fopen($csv_path, 'r');
    if (!$handle) throw new Exception('Failed to open CSV');

    $header = fgetcsv($handle);
    if (!$header) throw new Exception('CSV header missing');

    $inserted = 0;
    $skipped = 0;
    $errors = 0;

    while (($row = fgetcsv($handle)) !== false) {
        $data = array_combine($header, $row);
        if (!$data) continue;

        try {
            $event_id = normalize_str($data['event_id'] ?? null);
            $url = normalize_str($data['url'] ?? null);
            $name = normalize_str($data['name'] ?? null);
            $start_dt = iso_to_mysql_datetime($data['start_date'] ?? null, $data['start_time'] ?? null);

            // Address + place
            $street = normalize_str($data['loc_street'] ?? null);
            $postal = normalize_str($data['loc_post'] ?? null);
            $addr_key = $street . '|' . $CITY_NAME . '|' . $postal . '|' . $CITY_COUNTRY_CODE;
            if (isset($address_cache[$addr_key])) {
                $address_id = $address_cache[$addr_key];
            } else {
                $get_address->execute([$street ?: null, $CITY_NAME, $postal ?: null, $CITY_COUNTRY_CODE]);
                $arow = $get_address->fetch();
                if ($arow) {
                    $address_id = (int)$arow['id'];
                } else {
                    $ins_address->execute([$street ?: null, $CITY_NAME, $postal ?: null, $CITY_COUNTRY_CODE]);
                    $address_id = (int)$pdo->lastInsertId();
                }
                $address_cache[$addr_key] = $address_id;
            }

            $place_name = normalize_str($data['loc_name'] ?? null);
            $place_key = $place_name . '|' . $address_id;
            if (isset($place_cache[$place_key])) {
                $place_id = $place_cache[$place_key];
            } else {
                $get_place->execute([$place_name ?: null, $address_id]);
                $prow = $get_place->fetch();
                if ($prow) {
                    $place_id = (int)$prow['id'];
                } else {
                    $ins_place->execute([$place_name ?: null, $address_id, $city_id]);
                    $place_id = (int)$pdo->lastInsertId();
                }
                $place_cache[$place_key] = $place_id;
            }

            // Match existing
            $existing_id = null;
            if ($event_id !== '') {
                $find_event_id->execute([$event_id]);
                $erow = $find_event_id->fetch();
                if ($erow) $existing_id = (int)$erow['id'];
            }
            if (!$existing_id && $url !== '') {
                $find_event_url->execute([$url]);
                $erow = $find_event_url->fetch();
                if ($erow) $existing_id = (int)$erow['id'];
            }
            if (!$existing_id && $name !== '' && $start_dt && $place_id) {
                $find_event_fuzzy->execute([$name, $start_dt, $place_id]);
                $erow = $find_event_fuzzy->fetch();
                if ($erow) $existing_id = (int)$erow['id'];
            }

            if ($existing_id) {
                $log_row->execute([$run_id, $event_id ?: null, 'skip', 'matched existing event']);
                $skipped++;
                continue;
            }

            $end_dt = iso_to_mysql_datetime($data['end_date'] ?? null, $data['end_time'] ?? null);
            $upsert_event->execute([
                $event_id ?: null,
                $name,
                $data['description'] ?? null,
                $data['url'] ?? null,
                $data['image'] ?? null,
                $data['category'] ?? null,
                $data['tags'] ?? null,
                null,
                null,
                $place_id,
                $city_id,
                $start_dt,
                $end_dt,
            ]);
            $new_event_id = (int)$pdo->lastInsertId();

            $price_val = parse_price($data['price'] ?? null);
            if ($price_val !== null) {
                $ins_offer->execute([$new_event_id, $price_val, null, null]);
            }

            foreach (split_tags($data['tags'] ?? null) as $tag) {
                if (isset($tag_cache[$tag])) {
                    $tag_id = $tag_cache[$tag];
                } else {
                    $get_tag->execute([$tag]);
                    $trow = $get_tag->fetch();
                    if ($trow) {
                        $tag_id = (int)$trow['id'];
                    } else {
                        $ins_tag->execute([$tag]);
                        $tag_id = (int)$pdo->lastInsertId();
                    }
                    $tag_cache[$tag] = $tag_id;
                }
                $ins_event_tag->execute([$new_event_id, $tag_id]);
            }

            $log_row->execute([$run_id, $event_id ?: null, 'insert', 'inserted new event']);
            $inserted++;
        } catch (Exception $e) {
            $log_row->execute([$run_id, $event_id ?: null, 'error', substr($e->getMessage(), 0, 250)]);
            $errors++;
        }
    }

    fclose($handle);
    $pdo->commit();

    if ($DELETE_CSV_AFTER_SUCCESS) {
        unlink($csv_path);
    }

    echo "Import complete: inserted=$inserted skipped=$skipped errors=$errors\n";
} catch (Exception $e) {
    $pdo->rollBack();
    echo "ERROR: " . $e->getMessage() . "\n";
    http_response_code(500);
    exit(1);
}
