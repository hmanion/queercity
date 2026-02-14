# Handoff: Newsletter Generator + Repo State (2026-02-14)

## Scope completed
A weekly newsletter generator was implemented for the QueerCity runtime repo using one-off events from the DB-backed API.

## Implemented changes

### 1) Shared one-off event query layer
- Added: `/Users/harry/Desktop/queercity/queercity/api/lib/events_query.php`
- Function:
  - `fetch_one_off_events(PDO $pdo, ?string $fromDate, ?string $toDate, int $limit = 0): array`
- Purpose:
  - Centralizes SQL + mapping logic previously inside `api/output.php`
  - Keeps output shape compatible with existing API consumers

### 2) API refactor to shared query function
- Updated: `/Users/harry/Desktop/queercity/queercity/api/output.php`
- Behavior is unchanged externally (`from`, `to`, `limit` still supported).
- Now calls `fetch_one_off_events(...)`.

### 3) Newsletter CLI generator (tracked location)
- Added: `/Users/harry/Desktop/queercity/queercity/newsletter/generate_weekly_newsletter.php`
- Added: `/Users/harry/Desktop/queercity/queercity/newsletter/README_NEWSLETTER.md`

Generator behavior:
- Uses timezone `Europe/London`
- Computes **next calendar week** window (next Monday 00:00 to Sunday 23:59)
- Pulls one-off events via shared query function
- Filters invalid entries: requires `name`, `url`, `startDate`
- Sorts by start datetime
- Builds brief digest format grouped by day
- Writes:
  - `/Users/harry/Desktop/queercity/queercity/newsletter/output/newsletter-YYYY-MM-DD.html`
  - `/Users/harry/Desktop/queercity/queercity/newsletter/output/newsletter-YYYY-MM-DD.txt`
  - `/Users/harry/Desktop/queercity/queercity/newsletter/output/newsletter-YYYY-MM-DD.meta.json`
- Handles empty-week output gracefully
- Exits non-zero on runtime errors (DB/config/output-dir failures)

### 4) Git/allowlist/ignore updates
- Updated: `/Users/harry/Desktop/queercity/queercity/allowlist-main.txt`
  - Added:
    - `api/lib/events_query.php`
    - `newsletter/generate_weekly_newsletter.php`
    - `newsletter/README_NEWSLETTER.md`
- Updated: `/Users/harry/Desktop/queercity/queercity/.gitignore`
  - Added: `newsletter/output/` (generated artifacts ignored)

## Important environment note
Local shell in this Codex session did **not** have PHP installed (`php` not found), so execution/linting was not run here.

Validate on server/host with:
- `php -l /path/to/queercity/api/lib/events_query.php`
- `php -l /path/to/queercity/api/output.php`
- `php -l /path/to/queercity/newsletter/generate_weekly_newsletter.php`
- `php /path/to/queercity/newsletter/generate_weekly_newsletter.php`

Cron example in README:
- `0 9 * * 5 /usr/bin/php /path/to/queercity/newsletter/generate_weekly_newsletter.php >> /path/to/queercity/newsletter/output/newsletter-cron.log 2>&1`

## Parent repo correction that was done
There was an accidental parent-level git repo at `/Users/harry/Desktop/queercity/.git` causing confusion and huge staged diffs.

It was moved (not deleted) to:
- `/Users/harry/Desktop/queercity/.git.backup-20260214-093328`

Current intended repo is:
- `/Users/harry/Desktop/queercity/queercity`

## Current working tree context in `/Users/harry/Desktop/queercity/queercity`
There are additional unrelated content changes already present (category pages / index updates etc.).
Do **not** revert those unless explicitly requested.

## Suggested immediate next steps for the other thread
1. Run PHP lint and one newsletter generation run on the Ionos environment.
2. Confirm generated HTML/TXT copy tone and formatting in actual mail client.
3. Add cron entry on server.
4. Verify deploy strategy includes `/newsletter` if needed for server sync workflow.
