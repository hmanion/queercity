# Weekly Newsletter Generator

This script generates next week's one-off events newsletter content from the existing database-backed API query layer.

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

## Cron setup (Ionos)

Expected PHP binary:

- `/usr/bin/php`

Example weekly cron (Friday 09:00):

```cron
0 9 * * 5 /usr/bin/php /path/to/queercity/newsletter/generate_weekly_newsletter.php >> /path/to/queercity/newsletter/output/newsletter-cron.log 2>&1
```

The script enforces `Europe/London` timezone internally when computing next calendar week windows.
