# Weekly Newsletter Generator

This script generates next week's one-off events newsletter content from the existing database-backed API query layer.

Multi-day handling:
- Events lasting 24+ hours are shown in an **"Ongoing this week"** section (not only on their first day).

## Output files

Generated files are written to:

- `/Users/harry/Desktop/queercity/queercity/newsletter/output/newsletter-YYYY-MM-DD.html`
- `/Users/harry/Desktop/queercity/queercity/newsletter/output/newsletter-YYYY-MM-DD.txt`
- `/Users/harry/Desktop/queercity/queercity/newsletter/output/newsletter-YYYY-MM-DD.meta.json`

`YYYY-MM-DD` is the next week's Monday date.

## Manual run

```bash
php /path/to/queercity/newsletter/generate_weekly_newsletter.php
```

## Dry mode (no DB)

Use dry mode to validate newsletter formatting and output files without a database connection:

```bash
php /path/to/queercity/newsletter/generate_weekly_newsletter.php --dry
```

## Web trigger (token required)

If the script is accessed via URL, it now requires the same admin secret token (`import_token` from `config/db.php`):

```text
https://your-domain/queercity/newsletter/?token=YOUR_IMPORT_TOKEN
```

Without a valid token it returns `403 Forbidden`.

For web dry mode tests, keep the token and add `dry=1`:

```text
https://your-domain/queercity/newsletter/?token=YOUR_IMPORT_TOKEN&dry=1
```

## Cron setup (Ionos)

Expected PHP binary:

- `/usr/bin/php`

Example weekly cron (Friday 09:00):

```cron
0 9 * * 5 /usr/bin/php /path/to/queercity/newsletter/generate_weekly_newsletter.php >> /path/to/queercity/newsletter/output/newsletter-cron.log 2>&1
```

The script enforces `Europe/London` timezone internally when computing next calendar week windows.
