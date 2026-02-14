#!/usr/bin/env php
<?php

declare(strict_types=1);

require_once __DIR__ . '/../api/lib/events_query.php';

function stderr(string $message): void
{
    fwrite(STDERR, $message . PHP_EOL);
}

function html_escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function is_valid_event(array $event): bool
{
    $name = trim((string)($event['name'] ?? ''));
    $url = trim((string)($event['url'] ?? ''));
    $start = trim((string)($event['startDate'] ?? ''));
    return $name !== '' && $url !== '' && $start !== '';
}

function event_timestamp(array $event, DateTimeZone $tz): int
{
    $raw = (string)($event['startDate'] ?? '');
    try {
        return (new DateTimeImmutable($raw, $tz))->getTimestamp();
    } catch (Throwable $e) {
        return PHP_INT_MAX;
    }
}

function format_money(array $event): string
{
    $offers = $event['offers'] ?? null;
    if (!is_array($offers)) {
        return 'Price TBC';
    }
    $priceRaw = $offers['price'] ?? null;
    if ($priceRaw === null || $priceRaw === '') {
        return 'Price TBC';
    }
    $currency = (string)($offers['priceCurrency'] ?? '');
    $price = (float)$priceRaw;
    $priceText = rtrim(rtrim(number_format($price, 2, '.', ''), '0'), '.');
    if ($currency === 'GBP') {
        return 'Price: £' . $priceText;
    }
    if ($currency !== '') {
        return 'Price: ' . $priceText . ' ' . $currency;
    }
    return 'Price: ' . $priceText;
}

function format_event_time(DateTimeImmutable $start, ?DateTimeImmutable $end): string
{
    $startText = $start->format('H:i');
    if ($end === null) {
        return $startText;
    }
    return $startText . '-' . $end->format('H:i');
}

function parse_dt(?string $raw, DateTimeZone $tz): ?DateTimeImmutable
{
    if (!$raw) {
        return null;
    }
    try {
        return new DateTimeImmutable($raw, $tz);
    } catch (Throwable $e) {
        return null;
    }
}

function week_window(DateTimeImmutable $now): array
{
    $nextMonday = $now->modify('next monday')->setTime(0, 0, 0);
    $nextSunday = $nextMonday->modify('+6 days')->setTime(23, 59, 59);
    return [$nextMonday, $nextSunday];
}

function newsletter_subject(DateTimeImmutable $start, DateTimeImmutable $end): string
{
    return sprintf(
        'Queer City Manchester: Events for %s-%s',
        $start->format('j M'),
        $end->format('j M Y')
    );
}

function group_events_by_day(array $events, DateTimeZone $tz): array
{
    $grouped = [];
    foreach ($events as $event) {
        $start = parse_dt((string)($event['startDate'] ?? ''), $tz);
        if ($start === null) {
            continue;
        }
        $dayKey = $start->format('Y-m-d');
        if (!isset($grouped[$dayKey])) {
            $grouped[$dayKey] = [
                'label' => $start->format('l j F'),
                'events' => [],
            ];
        }
        $grouped[$dayKey]['events'][] = $event;
    }
    ksort($grouped);
    return $grouped;
}

function build_text_newsletter(
    string $subject,
    DateTimeImmutable $weekStart,
    DateTimeImmutable $weekEnd,
    array $events,
    DateTimeZone $tz
): string {
    $lines = [];
    $lines[] = $subject;
    $lines[] = '';
    $lines[] = sprintf(
        "Here's your Queer City roundup for %s to %s.",
        $weekStart->format('l j F Y'),
        $weekEnd->format('l j F Y')
    );
    $lines[] = '';

    if (!$events) {
        $lines[] = 'No one-off events were found for next week.';
        $lines[] = 'Check the site again later in the week for new additions.';
        return implode(PHP_EOL, $lines) . PHP_EOL;
    }

    foreach (group_events_by_day($events, $tz) as $day) {
        $lines[] = $day['label'];
        foreach ($day['events'] as $event) {
            $start = parse_dt((string)($event['startDate'] ?? ''), $tz);
            $end = parse_dt(isset($event['endDate']) ? (string)$event['endDate'] : null, $tz);
            $time = $start ? format_event_time($start, $end) : 'Time TBC';
            $venue = trim((string)($event['location']['name'] ?? ''));
            if ($venue === '') {
                $venue = 'Venue TBC';
            }
            $genre = trim((string)($event['genre'] ?? ''));
            if ($genre === '') {
                $genre = 'Genre TBC';
            }
            $lines[] = sprintf(
                '- %s | %s | %s | %s | %s',
                $time,
                (string)$event['name'],
                $venue,
                $genre,
                format_money($event)
            );
            $lines[] = '  ' . (string)$event['url'];
        }
        $lines[] = '';
    }

    return implode(PHP_EOL, $lines) . PHP_EOL;
}

function build_html_newsletter(
    string $subject,
    DateTimeImmutable $weekStart,
    DateTimeImmutable $weekEnd,
    array $events,
    DateTimeZone $tz
): string {
    $html = [];
    $html[] = '<!doctype html>';
    $html[] = '<html lang="en">';
    $html[] = '<head>';
    $html[] = '  <meta charset="utf-8">';
    $html[] = '  <meta name="viewport" content="width=device-width, initial-scale=1">';
    $html[] = '  <title>' . html_escape($subject) . '</title>';
    $html[] = '</head>';
    $html[] = '<body style="margin:0;padding:24px;font-family:Helvetica,Arial,sans-serif;line-height:1.5;color:#1b1b1b;">';
    $html[] = '  <h1 style="margin:0 0 12px;font-size:24px;">' . html_escape($subject) . '</h1>';
    $html[] = '  <p style="margin:0 0 16px;">' . html_escape(sprintf(
        "Here's your Queer City roundup for %s to %s.",
        $weekStart->format('l j F Y'),
        $weekEnd->format('l j F Y')
    )) . '</p>';

    if (!$events) {
        $html[] = '  <p style="margin:0;">No one-off events were found for next week. Check the site again later in the week for new additions.</p>';
        $html[] = '</body>';
        $html[] = '</html>';
        return implode(PHP_EOL, $html) . PHP_EOL;
    }

    foreach (group_events_by_day($events, $tz) as $day) {
        $html[] = '  <h2 style="margin:20px 0 8px;font-size:18px;">' . html_escape((string)$day['label']) . '</h2>';
        $html[] = '  <ul style="margin:0 0 0 18px;padding:0;">';
        foreach ($day['events'] as $event) {
            $start = parse_dt((string)($event['startDate'] ?? ''), $tz);
            $end = parse_dt(isset($event['endDate']) ? (string)$event['endDate'] : null, $tz);
            $time = $start ? format_event_time($start, $end) : 'Time TBC';
            $venue = trim((string)($event['location']['name'] ?? ''));
            if ($venue === '') {
                $venue = 'Venue TBC';
            }
            $genre = trim((string)($event['genre'] ?? ''));
            if ($genre === '') {
                $genre = 'Genre TBC';
            }
            $html[] = '    <li style="margin-bottom:10px;">';
            $html[] = '      <a href="' . html_escape((string)$event['url']) . '" style="color:#1559c1;text-decoration:none;"><strong>' . html_escape((string)$event['name']) . '</strong></a><br>';
            $html[] = '      <span>' . html_escape($time . ' | ' . $venue . ' | ' . $genre . ' | ' . format_money($event)) . '</span>';
            $html[] = '    </li>';
        }
        $html[] = '  </ul>';
    }

    $html[] = '</body>';
    $html[] = '</html>';
    return implode(PHP_EOL, $html) . PHP_EOL;
}

try {
    $tz = new DateTimeZone('Europe/London');
    $now = new DateTimeImmutable('now', $tz);
    [$weekStart, $weekEnd] = week_window($now);

    $config = require __DIR__ . '/../config/db.php';
    $requiredToken = (string)($config['import_token'] ?? '');
    $isCli = PHP_SAPI === 'cli';
    if (!$isCli) {
        $providedToken = '';
        if (isset($_GET['token'])) {
            $providedToken = (string)$_GET['token'];
        } elseif (isset($_POST['token'])) {
            $providedToken = (string)$_POST['token'];
        }
        if ($requiredToken === '' || !hash_equals($requiredToken, $providedToken)) {
            http_response_code(403);
            header('Content-Type: text/plain; charset=utf-8');
            echo "Forbidden\n";
            exit(1);
        }
    }

    $pdo = new PDO(
        "mysql:host={$config['host']};port={$config['port']};dbname={$config['name']};charset=utf8mb4",
        $config['user'],
        $config['pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );

    $sourceEvents = fetch_one_off_events($pdo, $weekStart->format('Y-m-d'), $weekEnd->format('Y-m-d'), 2000);
    $validEvents = array_values(array_filter($sourceEvents, 'is_valid_event'));

    usort($validEvents, fn(array $a, array $b): int => event_timestamp($a, $tz) <=> event_timestamp($b, $tz));

    $subject = newsletter_subject($weekStart, $weekEnd);
    $textBody = build_text_newsletter($subject, $weekStart, $weekEnd, $validEvents, $tz);
    $htmlBody = build_html_newsletter($subject, $weekStart, $weekEnd, $validEvents, $tz);

    $outputDir = __DIR__ . '/output';
    if (!is_dir($outputDir) && !mkdir($outputDir, 0775, true) && !is_dir($outputDir)) {
        throw new RuntimeException('Failed to create output directory: ' . $outputDir);
    }

    $slug = $weekStart->format('Y-m-d');
    $htmlPath = $outputDir . '/newsletter-' . $slug . '.html';
    $txtPath = $outputDir . '/newsletter-' . $slug . '.txt';
    $metaPath = $outputDir . '/newsletter-' . $slug . '.meta.json';

    file_put_contents($htmlPath, $htmlBody);
    file_put_contents($txtPath, $textBody);

    $meta = [
        'generated_at' => $now->format(DateTimeInterface::ATOM),
        'timezone' => 'Europe/London',
        'week_start' => $weekStart->format('Y-m-d'),
        'week_end' => $weekEnd->format('Y-m-d'),
        'source_events_count' => count($sourceEvents),
        'included_events_count' => count($validEvents),
        'skipped_invalid_count' => count($sourceEvents) - count($validEvents),
        'subject' => $subject,
        'html_path' => $htmlPath,
        'text_path' => $txtPath,
    ];
    file_put_contents($metaPath, json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL);

    echo "Newsletter generated" . PHP_EOL;
    echo "  Week: " . $meta['week_start'] . " to " . $meta['week_end'] . PHP_EOL;
    echo "  Included events: " . $meta['included_events_count'] . PHP_EOL;
    echo "  HTML: " . $htmlPath . PHP_EOL;
    echo "  Text: " . $txtPath . PHP_EOL;
    echo "  Meta: " . $metaPath . PHP_EOL;
    exit(0);
} catch (Throwable $e) {
    stderr('Newsletter generation failed: ' . $e->getMessage());
    exit(1);
}
