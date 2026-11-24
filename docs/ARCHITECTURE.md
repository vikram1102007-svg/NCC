# Architecture

## Current milestone
The first milestone is a static, mobile-first public information site using plain HTML, CSS and browser JavaScript. It does not accept participant data, issue QR passes, authenticate admins or process payments.

## Target architecture (subject to implementation review)
- Web application: React + TypeScript, or another maintainable frontend after tooling review.
- Backend/database: Supabase Auth + PostgreSQL.
- Authorization: server-side checks plus PostgreSQL Row Level Security; roles for super-admin, event-admin, check-in staff and read-only reporting.
- Registration: validated server-side endpoints, configurable individual/team rules, capacity locking and unique registration references.
- Payments: server-created gateway order, signature verification, verified webhooks, idempotent processing and reconciliation. Sandbox only until authorised beneficiary and merchant account are confirmed.
- QR check-in: opaque random token mapped to registration; server validates event/day and prevents duplicate check-in. QR must not contain participant PII.
- Exports/audit: role-restricted exports, audit events, retention policy and controlled deletion.
- Hosting: dedicated NCC project only; no deployment until project ownership and billing implications are clear.

## Data protection
- Minimise participant fields; collect emergency contact only if required and approved.
- Never store card, UPI PIN, OTP or other payment credentials.
- Keep secrets in environment variables; never commit .env files.
- Restrict admin access and protect participant endpoints with server-side authorization.
- Do not expose attendee lists, payment records or contact details publicly.
- Use synthetic test data in development and CI.

## Verification
- Local: `npm test` or `npm run check` (Node.js 20+).
- CI: GitHub Actions runs the static smoke suite on pushes and pull requests.
- Current checks cover the static shell and mobile navigation only. They are not security, backend, browser, accessibility-audit or payment tests.

## Future environment variables
Document exact variable names and safe setup instructions when backend integration is introduced. Never include real values in repository documentation or commits.
