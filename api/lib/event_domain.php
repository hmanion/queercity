<?php

if (!function_exists('event_genre_model')) {
    function event_genre_model(): array
    {
        return [
            [
                'slug' => 'life',
                'label' => 'Life',
                'aliases' => ['life'],
                'legacy_db_variants' => [],
            ],
            [
                'slug' => 'sex',
                'label' => 'Sex',
                'aliases' => ['sex', 'sexy'],
                'legacy_db_variants' => ['Sexy'],
            ],
            [
                'slug' => 'social',
                'label' => 'Social',
                'aliases' => ['social', 'socials'],
                'legacy_db_variants' => [],
            ],
            [
                'slug' => 'active',
                'label' => 'Active',
                'aliases' => ['active', 'activity', 'activities'],
                'legacy_db_variants' => ['Activity', 'Activities'],
            ],
            [
                'slug' => 'music',
                'label' => 'Music',
                'aliases' => ['music', 'club', 'clubs'],
                'legacy_db_variants' => ['Club', 'Clubs'],
            ],
            [
                'slug' => 'arts',
                'label' => 'Arts',
                'aliases' => ['arts', 'art'],
                'legacy_db_variants' => [],
            ],
            [
                'slug' => 'celebration',
                'label' => 'Celebration',
                'aliases' => ['celebration', 'celebrations'],
                'legacy_db_variants' => [],
            ],
        ];
    }
}

if (!function_exists('event_genre_allowed_labels')) {
    function event_genre_allowed_labels(): array
    {
        return array_map(
            static fn(array $item): string => $item['label'],
            event_genre_model()
        );
    }
}

if (!function_exists('event_genre_token_to_label_map')) {
    function event_genre_token_to_label_map(): array
    {
        $map = [];
        foreach (event_genre_model() as $item) {
            foreach ($item['aliases'] as $alias) {
                $map[$alias] = $item['label'];
            }
            // Accept canonical label token directly.
            $map[strtolower(preg_replace('/[^a-z0-9]+/i', '', $item['label']))] = $item['label'];
        }
        return $map;
    }
}

if (!function_exists('normalize_event_genre_token')) {
    function normalize_event_genre_token($value): string
    {
        return strtolower(preg_replace('/[^a-z0-9]+/i', '', trim((string)($value ?? ''))));
    }
}

if (!function_exists('normalize_event_genre_label')) {
    function normalize_event_genre_label($value): ?string
    {
        $text = trim((string)($value ?? ''));
        if ($text === '') {
            return null;
        }
        $token = normalize_event_genre_token($text);
        $map = event_genre_token_to_label_map();
        return $map[$token] ?? $text;
    }
}

if (!function_exists('normalize_event_genre_for_write')) {
    function normalize_event_genre_for_write($value): ?string
    {
        $text = trim((string)($value ?? ''));
        if ($text === '') {
            return null;
        }
        $token = normalize_event_genre_token($text);
        $map = event_genre_token_to_label_map();
        return $map[$token] ?? null;
    }
}

if (!function_exists('event_genre_filter_variants')) {
    function event_genre_filter_variants($value): array
    {
        $text = trim((string)($value ?? ''));
        if ($text === '') {
            return [];
        }

        $normalized = normalize_event_genre_label($text);
        if ($normalized === null) {
            return [];
        }

        foreach (event_genre_model() as $item) {
            if ($item['label'] === $normalized) {
                return array_values(array_unique(array_merge(
                    [$item['label']],
                    $item['legacy_db_variants']
                )));
            }
        }

        // Preserve existing behavior for unknown values: filter exactly what was requested.
        return [$text];
    }
}

if (!function_exists('shape_event_location')) {
    function shape_event_location(array $row): array
    {
        return [
            '@type' => 'Place',
            'name' => $row['place_name'] ?? null,
            'address' => [
                '@type' => 'PostalAddress',
                'streetAddress' => $row['street_address'] ?? null,
                'addressLocality' => $row['address_locality'] ?? null,
                'postalCode' => $row['postal_code'] ?? null,
                'addressCountry' => $row['address_country'] ?? null,
            ],
        ];
    }
}

if (!function_exists('shape_base_event')) {
    function shape_base_event(array $row): array
    {
        $item = [
            '@context' => 'https://schema.org',
            '@type' => 'Event',
            'identifier' => $row['identifier'] ?? null,
            'name' => $row['name'] ?? null,
            'eventStatus' => $row['event_status'] ?? null,
            'eventAttendanceMode' => $row['attendance_mode'] ?? null,
            'url' => $row['url'] ?? null,
            'description' => $row['description'] ?? null,
            'image' => $row['image_url'] ?? null,
            'genre' => normalize_event_genre_label($row['genre'] ?? null),
            'keywords' => $row['keywords_text'] ?? null,
            'location' => shape_event_location($row),
        ];

        // Keep one-off payload shape unchanged: include keys only when SQL row exposes them.
        if (array_key_exists('start_datetime', $row)) {
            $item['startDate'] = $row['start_datetime'] ? str_replace(' ', 'T', $row['start_datetime']) : null;
        }
        if (array_key_exists('end_datetime', $row)) {
            $item['endDate'] = $row['end_datetime'] ? str_replace(' ', 'T', $row['end_datetime']) : null;
        }

        return $item;
    }
}

if (!function_exists('shape_event_offers')) {
    function shape_event_offers(?array $offer): ?array
    {
        if ($offer === null) {
            return null;
        }
        return [
            '@type' => 'Offer',
            'price' => $offer['price'] ?? null,
            'priceCurrency' => $offer['price_currency'] ?? null,
            'url' => $offer['url'] ?? null,
        ];
    }
}
