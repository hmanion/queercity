# Queer City (Runtime Repo)

This repository stores website runtime code only.

Branch model:
- `main`: live runtime for Ionos (public site + PHP APIs + admin runtime)
- `pages`: static test runtime for GitHub Pages (public site only)

All non-runtime tooling (imports, migrations, generated reports, ad hoc scripts) belongs in a separate private operations repository.

## Runtime Policy

Only commit files required to run one of the two runtime branches.

Never commit here:
- one-off scripts/import tooling
- schema/migration SQL
- generated analysis artifacts
- local context files

Strict enforcement is in CI via branch-specific allowlists.

## Pages Branch (`pages`)

This branch is static-only and intended for GitHub Pages testing.

Included runtime:
- `/`, `/weekdays/`, `/archive/`
- static assets (`style.css`, `extended.woff2`, `/js/*.module.js`)
- fallback data (`output.json`, `directory.json`)

Excluded on this branch:
- `/api/*`
- `/admin/*`

## Main Branch (`main`)

Live runtime includes everything needed by Ionos:
- public frontend runtime
- PHP APIs (`/api/output.php`, `/api/directory.php`)
- admin runtime (`/admin/*`, `/api/admin-*`)

## Promotion Workflow

Changes should flow from `main` to `pages` via cherry-pick of static/runtime-safe commits only.

Do not merge `main` wholesale into `pages`.

## Deployment

Ionos deploy workflow:
- `.github/workflows/deploy-ionos.yml`

Current workflow deploys from `main` only.

## Local Setup

Run a local static server:
- `python3 -m http.server`

For PHP/API testing, use `main` branch with PHP runtime available.

Operational SQL (dedupe, migrations, one-off fixes) must live only in the private ops repo, not this runtime repo.

## License

Code:
- AGPL-3.0-only (`LICENSE`)

Event listings/data:
- `DATA_LICENSE.md`
