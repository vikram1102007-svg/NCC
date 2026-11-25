# Architecture

## Current milestone

The existing Embarko deployment is a static public information preview. The `feat/registration-foundation` branch adds a registration UI and backend source, but the branch is not merged/deployed and registration remains disabled by default. No Supabase project exists yet.

## Registration vertical slice (prepared, not live)

1. Browser reads only published event metadata and active categories using the Supabase publishable key.
2. Registration form remains disabled unless the public configuration explicitly enables it and the organiser has approved the privacy notice.
3. Browser submits to the public `register` Edge Function. The function uses `@supabase/server` with `auth: 'none'` and `verify_jwt = false` because participants are not required to create an account. This endpoint is public by design and must remain tightly constrained.
4. The handler checks the allowed origin, POST method, request size, honeypot, payload shape, server-side enable flag and HMAC-based per-IP/per-email rate limits.
5. The handler calls database RPCs using the server-only `ctx.supabaseAdmin` client. Secret keys are never sent to the browser.
6. The database validates event/category state, registration window, individual/team size and capacity. Event-row locking serialises capacity checks; advisory transaction locking serialises retries using the same idempotency key.
7. A unique event/category/email index blocks duplicate submissions. The response contains a registration reference and status only.

## Database and access model

- Supabase Auth + PostgreSQL is the selected target, pending creation of a dedicated NCC project.
- The migration defines events, categories, registrations, admin memberships, payments, attendance, audit events and rate-limit buckets.
- RLS is enabled on every table.
- Public SELECT is limited to published event metadata and active categories belonging to published events.
- Participant, payment, attendance, audit and rate-limit records have no anonymous/authenticated read policies.
- Admin membership users may read only their own active membership record. Admin management endpoints and role-specific policies remain future work.
- The two registration RPC functions are SECURITY DEFINER, use a fixed search path, and have execution revoked from PUBLIC, anon and authenticated; only service_role may call them.
- Explicit table grants are included because newly created Supabase tables may not receive Data API grants automatically.

## Target admin architecture

- Supabase Auth for administrator identity.
- Roles: super-admin, event-admin, check-in staff and read-only reporting.
- Authorization enforced in Edge Functions and RLS, never by hiding UI controls alone.
- Participant search, category/capacity management, check-in, exports and audit access restricted by event role.
- First super-admin enrolment must be performed through a trusted administrative procedure; no public self-enrolment endpoint.

## Payments and QR

- Payments table supports pending/succeeded/failed/refunded state tracking, but no provider integration or live payment is enabled.
- Use an institution-approved Indian gateway only after beneficiary approval and merchant credentials are supplied.
- Orders, signatures, webhooks and reconciliation must be verified server-side and idempotently.
- QR passes will use random opaque tokens; only token hashes are stored. The QR must never contain participant PII.
- QR issue, validation, duplicate-safe day-one/day-two attendance and staff audit are future milestones.

## Data protection

- Proposed initial fields are contact/participant name, email, phone, institution, category, and team name/member names for team categories. The organiser must approve this field list before use.
- Do not add identity numbers, home addresses, date of birth, medical details or emergency contacts without a documented requirement and approval.
- Never store card numbers, UPI PINs, OTPs or other payment credentials.
- Keep secrets in Edge Function environment variables. The browser config may contain only the Supabase URL and publishable key.
- Define retention, deletion, export and incident-response procedures before collecting real participant data.

## Hosting and verification

- Dedicated Embarko app: https://ncc-event-management.embarko.app
- Current live version: static preview 1.0.0. Backend changes are not deployed.
- CI runs Node.js syntax and test checks on pushes and pull requests.
- Edge Function type-checking, migration execution, RLS integration tests and browser end-to-end tests require a provisioned NCC backend and are not yet verified.
