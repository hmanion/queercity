# Queer City - Chat Context

## Project snapshot
- Static frontend (HTML/CSS/JS) in this repo.
- Primary production hosting is Ionos (`harrymanion.co.uk/queercity`).
- GitHub Pages is used as a demo/fallback deployment target.

## Data architecture
- Canonical runtime data is in MySQL on Ionos.
- Frontend reads JSON from PHP endpoints:
  - `/api/output.php` (one-off events)
  - `/api/directory.php` (recurring events)
- Frontend has fallback to static JSON when PHP API is unavailable:
  - `output.json`
  - `directory.json`

## Database model (important entities)
- `events` (core event records)
- `schedules` + `schedule_by_day` (recurring patterns)
- `offers` (price data)
- `places` + `postal_addresses`
- `tags` + `event_tags`
- `organizations` + `event_organizations`
- `cities`
- import audit tables:
  - `import_runs`
  - `import_rows`

## Import pipeline
- One-off/recurring JSON importer (PHP): `scripts/import_json_to_mysql.php`
- Partner CSV importer (PHP, token protected): `scripts/import.php`
  - Expects exactly one CSV in the `csvimport` directory.
  - Skips matched events, inserts new ones, logs audit rows.
  - Deletes CSV after successful run.

## Security/config
- DB credentials are loaded from `config/db.php` (not committed).
- Template file: `config/db.sample.php`
- `.gitignore` excludes `config/db.php`.
- Import token is read from `config/db.php` key: `import_token`.

## Deployment
- GitHub Actions workflow: `.github/workflows/deploy-ionos.yml`
- Deploy target via SFTP.
- Defaults:
  - Port: `22`
  - Remote dir: `/personal/queercity`
- Workflow excludes:
  - `config/db.php`
  - `csvimport/`
  - `.github/`, `.git/`, `scripts/`, `schema.sql`

## Frontend behavior notes
- Main events page only shows today onwards.
- Archive page shows past 1 year.
- Category normalization maps `Music` -> `Club`.
- Intended category labels: `Club`, `Celebration`, `Activity`, `Arts`, `Life`, `Sexy`.
- Archive now has category/tag filters.

## Useful operational checks
- Verify API output:
  - `/api/output.php?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - `/api/directory.php?limit=2000`
- Verify import audit:
  - `SELECT * FROM import_runs ORDER BY id DESC LIMIT 20;`
  - `SELECT * FROM import_rows WHERE run_id = ?;`

## Known platform constraints
- GitHub Pages cannot run PHP.
- Ionos Web Hosting Standard typically does not support Python runtime for production jobs; use PHP/cron there.
