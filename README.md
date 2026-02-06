# Queer City

Queer City is a static website that lists queer events in Manchester: regular recurring events (e.g. sports training), one-offs (e.g. comedy nights), multi-run events (e.g. theatre), and multi-day listings like exhibitions.

The listings are currently curated by me. I'm exploring ways to accept contributions in the future.

## Live site

This site is deployed via GitHub Pages.

## How it works

The site is plain HTML/CSS/JS and loads event data from JSON files at runtime.

Pages:
- `/` upcoming events (grouped into Today / Tomorrow / Week / Month(s) ahead)
- `/weekdays/` recurring events by weekday
- `/archive/` past one-off events

## Data files

- `output.json`: one-off events (including multi-day ranges like exhibitions)
- `directory.json`: recurring events (e.g. weekly / fortnightly / monthly patterns)

Event fields (high level):
- Common: `name`, `url`, `category`, `tags`, and location fields like `locName`, `locTown`, `locPost`
- Dates: `startDate` (YYYY-MM-DD), optional `endDate` (YYYY-MM-DD)
- Times: optional `startTime` / `endTime` (HH:MM)
- Recurring-only: `dayWeek`, `frequency`, optional `occurrence` (for monthly patterns)

## Run locally

Because the site uses `fetch()` to load JSON, you'll usually need to run a local web server (opening `index.html` via `file://` may not work).

Examples:
- `python3 -m http.server`
- `npx serve`

Then open the printed local URL in your browser.

## License

Code:
- Licensed under the GNU Affero General Public License v3.0 only (AGPL-3.0-only). See `LICENSE`.

Event listings / curation data:
- The compiled listings in `output.json` and `directory.json` are not licensed for reuse. See `DATA_LICENSE.md`.

## Sharing events

Please do share events widely: link to event pages, tell friends, and share individual event details.

If you want to republish the site's compiled listings as a dataset (e.g. to run another events site/newsletter), please ask first.
