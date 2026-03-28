<?php

require_once __DIR__ . '/event_domain.php';

function assert_same($expected, $actual, string $label): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, "FAIL: {$label}\n");
        fwrite(STDERR, "Expected: " . var_export($expected, true) . "\n");
        fwrite(STDERR, "Actual:   " . var_export($actual, true) . "\n");
        exit(1);
    }
}

// Display normalization keeps unknown labels untouched.
assert_same('Active', normalize_event_genre_label('activity'), 'display: activity -> Active');
assert_same('Music', normalize_event_genre_label('clubs'), 'display: clubs -> Music');
assert_same('Sex', normalize_event_genre_label('sexy'), 'display: sexy -> Sex');
assert_same('unknown', normalize_event_genre_label('unknown'), 'display: unknown passthrough');

// Write normalization accepts aliases and rejects unknown values.
assert_same('Active', normalize_event_genre_for_write('activity'), 'write: activity -> Active');
assert_same('Music', normalize_event_genre_for_write('clubs'), 'write: clubs -> Music');
assert_same('Sex', normalize_event_genre_for_write('sexy'), 'write: sexy -> Sex');
assert_same(null, normalize_event_genre_for_write('unknown'), 'write: unknown -> null');

// Filtering includes canonical plus legacy DB variants.
assert_same(['Active', 'Activity', 'Activities'], event_genre_filter_variants('active'), 'variants: active');
assert_same(['Music', 'Club', 'Clubs'], event_genre_filter_variants('clubs'), 'variants: clubs');
assert_same(['Sex', 'Sexy'], event_genre_filter_variants('sexy'), 'variants: sexy');
assert_same(['unknown'], event_genre_filter_variants('unknown'), 'variants: unknown passthrough');

// Canonical labels are centrally defined and stable.
assert_same(
    ['Life', 'Sex', 'Social', 'Active', 'Music', 'Arts', 'Celebration'],
    event_genre_allowed_labels(),
    'allowed labels'
);

// Base event shaping behavior for one-off payloads (includes startDate/endDate keys).
$oneOffRow = [
    'identifier' => 'evt-1',
    'name' => 'Sample Event',
    'event_status' => 'EventScheduled',
    'attendance_mode' => 'OfflineEventAttendanceMode',
    'start_datetime' => '2026-04-01 10:30:00',
    'end_datetime' => null,
    'url' => 'https://example.com/e/1',
    'description' => 'Desc',
    'image_url' => 'https://example.com/i.jpg',
    'genre' => 'clubs',
    'keywords_text' => 'community, meetup',
    'place_name' => 'Venue',
    'street_address' => '1 Street',
    'address_locality' => 'Manchester',
    'postal_code' => 'M1 1AA',
    'address_country' => 'GB',
];
$oneOff = shape_base_event($oneOffRow);
assert_same('2026-04-01T10:30:00', $oneOff['startDate'], 'one-off startDate');
assert_same(null, $oneOff['endDate'], 'one-off endDate');
assert_same('Music', $oneOff['genre'], 'one-off normalized genre');

// Base event shaping behavior for recurring payloads (no startDate/endDate keys).
$recurringRow = $oneOffRow;
unset($recurringRow['start_datetime'], $recurringRow['end_datetime']);
$recurring = shape_base_event($recurringRow);
assert_same(false, array_key_exists('startDate', $recurring), 'recurring has no startDate key');
assert_same(false, array_key_exists('endDate', $recurring), 'recurring has no endDate key');

// Offer shaping output contract.
assert_same(
    [
        '@type' => 'Offer',
        'price' => '10.00',
        'priceCurrency' => 'GBP',
        'url' => 'https://example.com/ticket',
    ],
    shape_event_offers(['price' => '10.00', 'price_currency' => 'GBP', 'url' => 'https://example.com/ticket']),
    'offers shape'
);
assert_same(null, shape_event_offers(null), 'offers null');

fwrite(STDOUT, "event_domain tests: ok\n");
