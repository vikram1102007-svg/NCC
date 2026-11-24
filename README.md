# NCC Two-Day Event Management Website

A dedicated project for the college's two-day NCC event. This repository is the source of truth for application code, database migrations, setup instructions, architecture, decisions, issues and progress reports.

> Event name, college/unit details, dates, venue, fees, eligibility, permissions, contacts and official branding remain placeholders until supplied and approved.

## Current status

- Public information preview remains live on Embarko: https://ncc-event-management.embarko.app (last verified deployment version 1.0.0).
- A registration foundation is being reviewed on branch `feat/registration-foundation`; it has not been merged or deployed.
- The branch adds a responsive registration form, but it is disabled by default and does not collect participant data until organiser approval and backend configuration.
- Supabase migration and public registration Edge Function source are prepared. They have **not** been applied or deployed.

- Registration request handling now rejects non-object JSON before reading fields; the shared validator safely handles null, arrays and primitive payloads. The database RPC explicitly validates the contact name, and the migration has a single registration function with complete slug/category/hash guards.
- GitHub Actions run #21 passed for commit `d88f5b22c131bd32f04a62f91d80cbf5ff4f9c4a`: `npm run check`, 14 tests passed, 0 failed. This is Node.js syntax/unit/smoke coverage only; it does not verify Supabase execution or deployment.
- The connected Supabase account currently has no projects. A dedicated project was quoted at $0/month in the selected organisation, but project creation has not been performed pending the user's explicit confirmation.
- Admin login/dashboard, participant management, QR passes, check-in, exports and payment workflows are not yet implemented.
- No real participant data, payment keys or secrets are stored.

## Run locally

Requirements: Node.js 20 or later.

1. Clone this repository.
2. Open `index.html` in a browser, or run `python -m http.server 8000` and visit http://localhost:8000.
3. Run `npm test` for the Node.js test suite.
4. Run `npm run check` for JavaScript syntax checks and tests.

## Project structure

- `index.html` — public event information and gated registration form
- `assets/styles.css` — responsive styling
- `scripts/app.js` — navigation, public event/category loading and registration submission
- `scripts/config.js` — public-only browser configuration placeholders; publishable key only
- `supabase/migrations/` — versioned database schema and RLS policies
- `supabase/functions/register/` — public registration Edge Function
- `supabase/functions/_shared/` — validation shared with tests
- `test/` — site, registration validation and migration safety tests
- `.github/workflows/ci.yml` — CI checks on pushes and pull requests
- `docs/ARCHITECTURE.md` — architecture and security boundaries
- `docs/DECISIONS.md` — project decisions
- `docs/REGISTRATION_SETUP.md` — backend setup and activation gates
- `docs/TESTING.md` — local and CI verification
- `docs/progress/` — dated progress reports

## Registration activation

The registration form stays disabled unless all of the following are true:
- The organiser has approved the event facts, participant fields and privacy notice.
- A dedicated NCC Supabase project is created and the migration is applied.
- Approved event/category rows are published and registration is open.
- The registration Edge Function is deployed and its server-only secrets are configured.
- `scripts/config.js` contains the public project URL, publishable key, approved event slug, and explicit approval flags plus an HTTPS privacy notice URL.

See [Registration setup](docs/REGISTRATION_SETUP.md). Never put a secret/service-role key in browser code.

## Payments and QR

- No payment provider is selected or enabled. Use only an institution-approved beneficiary and gateway; sandbox first.
- Never treat a client-side redirect as proof of payment.
- QR passes will use opaque tokens only, never participant personal information. QR issuance and check-in are not implemented in this branch.

## Safety and privacy

- Never commit secrets, API keys, payment credentials, participant exports or real personal data.
- Use synthetic test records only.
- Enforce admin authorization server-side and with database policies.
- Do not expose attendee lists, payment records or contact details publicly.
- Collect only the minimum organiser-approved fields and define retention/deletion before registration opens.
- Do not publish official NCC/college logos or claims without permission.

See the architecture, decisions, registration setup and testing documents for implementation details.
