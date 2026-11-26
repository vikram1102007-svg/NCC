# Architecture

## Current state

- Dedicated public preview: https://ncc-event-management.embarko.app (static version 1.0.0).
- Registration migration and Edge Function source are merged to `main`, but no NCC Supabase project exists and nothing has been applied or deployed.
- A safety-fix branch disables the browser-only account/admin/payment prototype until the secure backend is ready.

## Target registration architecture

1. Browser reads only published event metadata and active categories using the Supabase publishable key.
2. Registration stays closed until organiser-approved event facts, fields and privacy notice are configured.
3. Browser submits to the public `register` Edge Function. The function uses `@supabase/server` with `auth: 'none'` because participant accounts are not required; the endpoint must remain tightly constrained.
4. The handler validates origin, method, request size, honeypot, payload shape, server-side enable flag and HMAC-based IP/email rate limits.
5. Server-only Supabase service credentials call registration RPCs; never expose them to the browser.
6. Database validates event/category state, registration window, individual/team rules and capacity. Locks protect capacity and idempotency.
7. Unique constraints prevent duplicate submissions. The response returns only a registration reference/status.

## Database and access model

- Supabase Auth + PostgreSQL is the selected target, pending a dedicated project.
- Migration defines event/category metadata, registrations, admin memberships, payments, attendance, audit events and rate limits.
- RLS is enabled for all tables.
- Public SELECT is limited to published event metadata and active categories.
- Participant, payment, attendance, audit and rate-limit records must not be publicly readable.
- SECURITY DEFINER RPCs use a fixed search path and restricted execution grants.
- Explicit table grants are used rather than relying on implicit Data API defaults.

## Admin

- Supabase Auth for administrator identity.
- Roles: super-admin, event-admin, check-in staff and read-only reporting.
- Authorization must be enforced by Edge Functions and RLS, never only by hiding UI.
- First super-admin creation must use a trusted administrative procedure.
- Participant search, category/capacity management, check-in, exports and audit access are future backend milestones.

## Payments and QR

- No payment provider or beneficiary is approved.
- Live payments require institution-approved merchant onboarding, server-created orders, server-side signature/webhook verification and idempotent reconciliation.
- Never store card, UPI PIN, OTP or other payment credentials.
- QR passes must use random opaque tokens; store only token hashes and never encode participant PII.
- QR issue, validation, duplicate-safe day-wise attendance and staff audit are not implemented.

## Data protection

- Proposed minimum fields: participant/contact name, email, phone, institution, category, and team name/member names for team categories. Organiser approval is required.
- Do not add identity numbers, home address, DOB, medical or emergency-contact details without documented need and privacy/retention approval.
- Use synthetic test records.
- Keep secrets in Edge Function environment variables; browser config may contain only project URL and publishable key.
- Define retention, deletion, export and incident response before real participant data collection.

## Hosting and verification

- Embarko preview remains static version 1.0.0.
- CI currently runs Node syntax and automated tests.
- Live migration, Edge Function, RLS, integration and end-to-end checks require a provisioned NCC project.
