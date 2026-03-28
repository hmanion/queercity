<?php

if (!function_exists('qc_table_exists')) {
    function qc_table_exists(PDO $pdo, string $tableName): bool
    {
        $stmt = $pdo->prepare(
            'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1'
        );
        $stmt->execute([$tableName]);
        return (bool)$stmt->fetchColumn();
    }
}

if (!function_exists('qc_column_exists')) {
    function qc_column_exists(PDO $pdo, string $tableName, string $columnName): bool
    {
        $stmt = $pdo->prepare(
            'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1'
        );
        $stmt->execute([$tableName, $columnName]);
        return (bool)$stmt->fetchColumn();
    }
}

if (!function_exists('qc_slugify_pride_borough')) {
    function qc_slugify_pride_borough(?string $borough): string
    {
        $raw = strtolower(trim((string)$borough));
        $token = preg_replace('/[^a-z]+/', '', $raw);
        $aliases = [
            'cityofmanchester' => 'Manchester',
            'manchestercity' => 'Manchester',
            'levenshulme' => 'Manchester',
        ];

        if (isset($aliases[$token])) {
            return $aliases[$token];
        }

        $map = [
            'bolton' => 'Bolton',
            'bury' => 'Bury',
            'manchester' => 'Manchester',
            'oldham' => 'Oldham',
            'rochdale' => 'Rochdale',
            'salford' => 'Salford',
            'stockport' => 'Stockport',
            'tameside' => 'Tameside',
            'trafford' => 'Trafford',
            'wigan' => 'Wigan',
        ];

        return $map[$token] ?? trim((string)$borough);
    }
}

if (!function_exists('qc_default_pride_seed_data')) {
    function qc_default_pride_seed_data(): array
    {
        return [
            ['name' => 'Didsbury Pride', 'website_url' => 'https://didsburypride.org.uk/', 'location' => 'Didsbury', 'borough' => 'Manchester'],
            ['name' => 'Chorlton Pride', 'website_url' => 'https://chorltonpride.co.uk/sponsors', 'location' => 'Chorlton', 'borough' => 'Manchester'],
            ['name' => 'Rochdale in Rainbows', 'website_url' => 'https://www.rochdale.gov.uk/sports-leisure/rochdale-rainbows-presents-pride', 'location' => 'Rochdale', 'borough' => 'Rochdale'],
            ['name' => 'Pride Oldham', 'website_url' => 'https://prideoldham.co.uk/', 'location' => 'Oldham', 'borough' => 'Oldham'],
            ['name' => 'Pride in Bolton', 'website_url' => 'https://pridebolton.co.uk/', 'location' => 'Bolton', 'borough' => 'Bolton'],
            ['name' => 'Stockport Pride', 'website_url' => 'https://www.stockportpride.co.uk/', 'location' => 'Stockport', 'borough' => 'Stockport'],
            ['name' => 'Levenshulme Pride', 'website_url' => 'https://levenshulmepride.org.uk/', 'location' => 'Levenshulme', 'borough' => 'Levenshulme'],
            ['name' => 'Wigan Pride', 'website_url' => 'https://www.wiganpride.com/', 'location' => 'Wigan', 'borough' => 'Wigan'],
            ['name' => 'Bury Pride', 'website_url' => 'https://www.burypride.co.uk/', 'location' => 'Bury', 'borough' => 'Bury'],
            ['name' => 'Pride in Trafford', 'website_url' => 'https://prideintrafford.org/', 'location' => 'Trafford', 'borough' => 'Trafford'],
            ['name' => 'Pride on the Range', 'website_url' => 'https://www.instagram.com/prideontherange/?hl=en', 'location' => 'Whalley Range', 'borough' => 'Manchester'],
            ['name' => 'Sparkle Weekend', 'website_url' => 'https://linktr.ee/sparkle.charity', 'location' => 'Gay Village', 'borough' => 'Manchester'],
            ['name' => 'MUD Alternative Pride', 'website_url' => '', 'location' => 'Platt Fields Market Garden', 'borough' => 'Manchester'],
            ['name' => 'Manchester Village Pride', 'website_url' => 'https://www.manchestervillagepride.org', 'location' => 'Gay Village', 'borough' => 'Manchester'],
        ];
    }
}

if (!function_exists('qc_fetch_prides')) {
    function qc_fetch_prides(PDO $pdo, bool $includeUnpublished = false): array
    {
        if (!qc_table_exists($pdo, 'prides')) {
            return [];
        }

        $requiredColumns = ['id', 'name', 'website_url', 'location', 'borough', 'start_date', 'end_date'];
        foreach ($requiredColumns as $columnName) {
            if (!qc_column_exists($pdo, 'prides', $columnName)) {
                throw new RuntimeException('The prides table is missing the required "' . $columnName . '" column.');
            }
        }

        $hasPublished = qc_column_exists($pdo, 'prides', 'published');
        $hasSlug = qc_column_exists($pdo, 'prides', 'slug');
        $hasNotes = qc_column_exists($pdo, 'prides', 'notes');
        $hasEventPride = qc_column_exists($pdo, 'events', 'pride_id');
        $hasEventStatus = qc_column_exists($pdo, 'events', 'event_status');

        $sql = 'SELECT p.id, p.name, p.website_url, p.location, p.borough, p.start_date, p.end_date, '
            . ($hasPublished ? 'p.published' : '1 AS published') . ', '
            . ($hasSlug ? 'p.slug' : 'NULL AS slug') . ', '
            . ($hasNotes ? 'p.notes' : 'NULL AS notes') . ', '
            . ($hasEventPride
                ? 'COALESCE(ec.event_count, 0) AS event_count'
                : '0 AS event_count')
            . ' FROM prides p ';

        if ($hasEventPride) {
            $sql .= 'LEFT JOIN (
                SELECT e.pride_id, COUNT(DISTINCT e.id) AS event_count
                FROM events e
                WHERE e.pride_id IS NOT NULL';
            if ($hasEventStatus) {
                $sql .= " AND (e.event_status IS NULL OR e.event_status = '' OR LOWER(e.event_status) NOT IN ('cancelled', 'deleted', 'draft'))";
            }
            $sql .= ' GROUP BY e.pride_id
            ) ec ON ec.pride_id = p.id ';
        }

        $conditions = [];
        if ($hasPublished && !$includeUnpublished) {
            $conditions[] = 'p.published = 1';
        }
        if ($conditions) {
            $sql .= 'WHERE ' . implode(' AND ', $conditions) . ' ';
        }

        $sql .= 'ORDER BY CASE WHEN p.start_date IS NULL THEN 1 ELSE 0 END ASC, p.start_date ASC, p.name ASC';

        $rows = $pdo->query($sql)->fetchAll();

        return array_map(static function (array $row): array {
            return [
                'id' => isset($row['id']) ? (int)$row['id'] : null,
                'name' => trim((string)($row['name'] ?? '')),
                'websiteUrl' => trim((string)($row['website_url'] ?? '')),
                'location' => trim((string)($row['location'] ?? '')),
                'borough' => qc_slugify_pride_borough($row['borough'] ?? ''),
                'startDate' => $row['start_date'] ?: null,
                'endDate' => $row['end_date'] ?: null,
                'eventCount' => max(0, (int)($row['event_count'] ?? 0)),
                'published' => (int)($row['published'] ?? 1),
                'slug' => isset($row['slug']) ? trim((string)$row['slug']) : '',
                'notes' => isset($row['notes']) ? trim((string)$row['notes']) : '',
            ];
        }, $rows);
    }
}
