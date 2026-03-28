<?php

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/lib/prides_query.php';

function qc_admin_prides_fail(int $code, string $message): void
{
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit;
}

function qc_admin_prides_text($value): ?string
{
    if ($value === null) {
        return null;
    }
    $text = trim((string)$value);
    return $text === '' ? null : $text;
}

function qc_admin_prides_bool($value): int
{
    if (is_bool($value)) {
        return $value ? 1 : 0;
    }
    $raw = strtolower(trim((string)$value));
    return in_array($raw, ['1', 'true', 'yes', 'on'], true) ? 1 : 0;
}

$configPath = __DIR__ . '/../config/db.php';
if (!file_exists($configPath)) {
    qc_admin_prides_fail(500, 'Server config missing');
}

$config = require $configPath;
$requiredToken = $config['import_token'] ?? '';

$rawBody = file_get_contents('php://input');
$payload = json_decode($rawBody ?: '{}', true);
if (!is_array($payload)) {
    $payload = [];
}

$providedToken = $_GET['token'] ?? $payload['token'] ?? $_POST['token'] ?? '';
if ($requiredToken === '' || $providedToken !== $requiredToken) {
    qc_admin_prides_fail(403, 'Forbidden');
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

    if (!qc_table_exists($pdo, 'prides')) {
        qc_admin_prides_fail(500, 'The database is missing the prides table.');
    }

    $requiredColumns = ['id', 'name', 'website_url', 'location', 'borough', 'start_date', 'end_date'];
    foreach ($requiredColumns as $columnName) {
        if (!qc_column_exists($pdo, 'prides', $columnName)) {
            qc_admin_prides_fail(500, 'The prides table is missing the required "' . $columnName . '" column.');
        }
    }

    $hasPublished = qc_column_exists($pdo, 'prides', 'published');
    $hasSlug = qc_column_exists($pdo, 'prides', 'slug');
    $hasNotes = qc_column_exists($pdo, 'prides', 'notes');

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        echo json_encode([
            'prides' => qc_fetch_prides($pdo, true),
            'seed' => qc_default_pride_seed_data(),
            'boroughs' => ['Bolton', 'Bury', 'Manchester', 'Oldham', 'Rochdale', 'Salford', 'Stockport', 'Tameside', 'Trafford', 'Wigan', 'Levenshulme'],
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        qc_admin_prides_fail(405, 'Method not allowed');
    }

    $action = strtolower(trim((string)($payload['action'] ?? '')));
    if ($action === '') {
        qc_admin_prides_fail(422, 'Action is required');
    }

    $pdo->beginTransaction();

    if ($action === 'save') {
        $id = isset($payload['id']) ? (int)$payload['id'] : 0;
        $name = qc_admin_prides_text($payload['name'] ?? null);
        $websiteUrl = qc_admin_prides_text($payload['website_url'] ?? null);
        $location = qc_admin_prides_text($payload['location'] ?? null);
        $borough = qc_slugify_pride_borough(qc_admin_prides_text($payload['borough'] ?? null));
        $startDate = qc_admin_prides_text($payload['start_date'] ?? null);
        $endDate = qc_admin_prides_text($payload['end_date'] ?? null);
        $published = qc_admin_prides_bool($payload['published'] ?? 0);
        $slug = qc_admin_prides_text($payload['slug'] ?? null);
        $notes = qc_admin_prides_text($payload['notes'] ?? null);

        if ($name === null) {
            qc_admin_prides_fail(422, 'Pride name is required');
        }
        if ($borough === '') {
            qc_admin_prides_fail(422, 'Borough is required');
        }
        if ($startDate !== null && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate)) {
            qc_admin_prides_fail(422, 'Start date must be YYYY-MM-DD');
        }
        if ($endDate !== null && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
            qc_admin_prides_fail(422, 'End date must be YYYY-MM-DD');
        }
        if ($startDate !== null && $endDate !== null && $endDate < $startDate) {
            qc_admin_prides_fail(422, 'End date must be on or after the start date');
        }

        $columns = ['name', 'website_url', 'location', 'borough', 'start_date', 'end_date'];
        $params = [$name, $websiteUrl, $location, $borough, $startDate, $endDate];

        if ($hasPublished) {
            $columns[] = 'published';
            $params[] = $published;
        }
        if ($hasSlug) {
            $columns[] = 'slug';
            $params[] = $slug;
        }
        if ($hasNotes) {
            $columns[] = 'notes';
            $params[] = $notes;
        }

        if ($id > 0) {
            $assignments = implode(', ', array_map(static fn(string $column): string => $column . ' = ?', $columns));
            $params[] = $id;
            $stmt = $pdo->prepare('UPDATE prides SET ' . $assignments . ' WHERE id = ?');
            $stmt->execute($params);
        } else {
            $stmt = $pdo->prepare(
                'INSERT INTO prides (' . implode(', ', $columns) . ') VALUES (' . implode(', ', array_fill(0, count($columns), '?')) . ')'
            );
            $stmt->execute($params);
            $id = (int)$pdo->lastInsertId();
        }

        $pdo->commit();
        echo json_encode([
            'ok' => true,
            'prides' => qc_fetch_prides($pdo, true),
            'saved_id' => $id,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'delete') {
        $id = isset($payload['id']) ? (int)$payload['id'] : 0;
        if ($id <= 0) {
            qc_admin_prides_fail(422, 'A pride id is required');
        }

        $stmt = $pdo->prepare('DELETE FROM prides WHERE id = ?');
        $stmt->execute([$id]);
        $pdo->commit();
        echo json_encode([
            'ok' => true,
            'prides' => qc_fetch_prides($pdo, true),
            'deleted_id' => $id,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'seed_defaults') {
        $seed = qc_default_pride_seed_data();
        $existingStmt = $pdo->prepare('SELECT id FROM prides WHERE name = ? LIMIT 1');
        $insertColumns = ['name', 'website_url', 'location', 'borough', 'start_date', 'end_date'];
        if ($hasPublished) {
            $insertColumns[] = 'published';
        }
        if ($hasSlug) {
            $insertColumns[] = 'slug';
        }
        if ($hasNotes) {
            $insertColumns[] = 'notes';
        }
        $insertStmt = $pdo->prepare(
            'INSERT INTO prides (' . implode(', ', $insertColumns) . ') VALUES (' . implode(', ', array_fill(0, count($insertColumns), '?')) . ')'
        );

        foreach ($seed as $record) {
            $existingStmt->execute([$record['name']]);
            if ($existingStmt->fetch()) {
                continue;
            }

            $params = [
                $record['name'],
                $record['website_url'],
                $record['location'],
                qc_slugify_pride_borough($record['borough']),
                null,
                null,
            ];
            if ($hasPublished) {
                $params[] = 0;
            }
            if ($hasSlug) {
                $params[] = null;
            }
            if ($hasNotes) {
                $params[] = null;
            }
            $insertStmt->execute($params);
        }

        $pdo->commit();
        echo json_encode([
            'ok' => true,
            'prides' => qc_fetch_prides($pdo, true),
            'seeded' => count($seed),
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    qc_admin_prides_fail(422, 'Unknown action');
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    qc_admin_prides_fail(500, 'Failed to manage prides: ' . $e->getMessage());
}
