# NCC Two-Day Event Management Website

A dedicated repository for the college's two-day NCC event. This is the source of truth for the website, backend source, migrations, architecture, decisions, issue backlog and progress reports.

> Event name, college/unit details, dates, venue, eligibility, categories, rules, fees, permissions, contacts and official branding are placeholders until supplied and approved.

## Current status

- Public preview URL recorded by the project: https://ncc-event-management.embarko.app. The current main commit has not been independently verified deployed there.
- Safety and CI correction PR #8 is **merged** into `main`: https://github.com/vikram1102007-svg/NCC/pull/8.
- Current main commit: `82e2ad1ef2951ec3832aed2d46efc8f2549ded8d`. GitHub Actions run #69 passed: `npm run check`, 22 tests passed, 0 failed.
- Registration/login are intentionally closed in the preview. The browser-local account/admin/payment demo has been removed; no participant data or payment references are collected.
- Supabase migration and registration Edge Function source are prepared, but no NCC Supabase project exists and the migration/function have not been applied/deployed.
- Admin management, QR passes, attendance, exports and payment processing are not live. See [Run 13 progress report](docs/progress/2026-11-26-run-13.md) for the issue-by-issue audit and blockers.

## Run locally

Requirements: Node.js 20 or later.

1. Clone the repository.
2. Open `index.html` in a browser, or run `python -m http.server 8000` and visit http://localhost:8000.
3. Run `npm test` for tests.
4. Run `npm run check` for JavaScript syntax checks and tests.

## Structure

- `index.html`, `events.html` — public event information with unapproved facts kept as placeholders
- `register.html`, `login.html`, `participant.html`, `admin.html`, `payment.html` — backend-pending portal pages
- `ncc.js` — safe preview behavior; no browser-local persistence of passwords or participant records
- `ncc.css` — responsive styling
- `scripts/config.js` — public-only backend configuration placeholders
- `supabase/migrations/` — versioned PostgreSQL schema and RLS
- `supabase/functions/register/` — public registration Edge Function source
- `supabase/functions/_shared/` — shared validation
- `test/` — static-site and registration/migration tests
- `.github/workflows/ci.yml` — CI
- `docs/` — architecture, decisions, setup, testing and progress reports

## Registration activation gates

Registration can be enabled only after:
- Organisers approve event facts, categories, capacity, participant fields and a privacy notice.
- A dedicated NCC Supabase project is created in the user-confirmed organisation and region.
- The migration is applied and RLS/security advisories are reviewed.
- A trusted super-admin is created.
- The registration Edge Function is deployed with server-only secrets.
- Synthetic end-to-end registration, duplicate and capacity tests pass.
- The public origin and browser publishable-key configuration are reviewed.

See [Registration setup](docs/REGISTRATION_SETUP.md). Never put a service-role key or other secret in browser code.

## Payments and QR

- No gateway or beneficiary is approved/configured.
- The payment prototype and fictional UPI QR have been removed from this safety-fix branch.
- Live payments require an institution-approved merchant account, server-created orders, verified signatures/webhooks and idempotent reconciliation.
- QR passes must contain opaque tokens only; QR issuance and attendance are not implemented.

## Safety and privacy

- Never commit secrets, API keys, payment credentials, participant exports or real personal data.
- Use synthetic test records only.
- Enforce admin authorization server-side and through database policies.
- Do not expose attendee lists, payment records or contact details publicly.
- Define retention, deletion and export rules before collecting real data.
- Do not publish official NCC/college logos or claims without permission.
