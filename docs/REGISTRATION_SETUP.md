# Registration setup and activation

## Current state

The public registration form is intentionally disabled. The registration endpoint source and database migration are prepared, but neither is deployed because the NCC Supabase project has not been created/approved. The proposed field list below must also be approved by the event organiser before collecting real participant data.

## Proposed minimum fields

- Category (from the event's published categories)
- Contact/lead name
- Contact email
- Contact phone
- Institution name
- Team name and member names only for categories configured as team registration

Do not add date of birth, home address, identity numbers, medical details, parent details or emergency contact unless the organiser documents a genuine requirement and approves a privacy/retention plan.

## Supabase project setup

1. Create a dedicated NCC Supabase project in the approved organisation and region. Do not reuse MediReach or any other project.
2. Apply `supabase/migrations/20261124210000_ncc_registration_foundation.sql` using the migration workflow.
3. Create the first super-admin membership through a trusted, authenticated administrative procedure. Never expose an admin-enrolment endpoint to anonymous visitors.
4. Insert the approved event and category rows. Keep `is_published=false`, `registration_open=false`, and categories inactive until the organiser approves the public information.
5. Deploy the `register` Edge Function from this repository. It uses Supabase's `@supabase/server` SDK and the server-only `ctx.supabaseAdmin` client.
6. Set Edge Function secrets:
   - `NCC_REGISTRATION_ENABLED=false` initially
   - `NCC_RATE_LIMIT_SECRET` to a random secret of at least 32 characters
   - `NCC_ALLOWED_ORIGINS` to a comma-separated list of approved origins; include the Embarko URL only after deployment
7. Add only the Supabase project URL, publishable key, approved event slug, registration toggle and privacy-notice approval/HTTPS URL to `scripts/config.js`. The publishable key is intended for browser use; never put a secret/service-role key in this file.
8. Set `privacyNoticeApproved=true` and provide an HTTPS `privacyNoticeUrl` only after the organiser approves and publishes the notice.
9. Keep both the server-side `NCC_REGISTRATION_ENABLED` flag and database event `registration_open` false until the organiser approves the event facts, fields, privacy notice, capacity and registration dates.

## Endpoint behavior

- `POST /functions/v1/register` accepts a validated registration request.
- The endpoint checks origin, request size, honeypot, input shape, an HMAC-based per-IP and per-email rate limit, and database registration rules.
- Database capacity checks are serialised by locking the event row.
- Idempotency keys prevent duplicate writes on retries. Reusing a key with different data is rejected.
- Duplicate event/category/email submissions are rejected.
- The response contains a registration reference and status only. It does not return participant data or a QR token.
- QR passes, payment collection and admin workflows are not part of this milestone.

## Privacy and security

- The registration tables have RLS enabled and no anonymous/authenticated participant-read policy.
- Public users can read only published event metadata and active categories.
- The database RPC functions are SECURITY DEFINER but have execution revoked from PUBLIC, anon and authenticated; only the server-side service role can call them.
- Newly created tables receive explicit grants; do not assume Supabase automatically grants Data API access.
- Secret keys stay in Edge Function environment variables. Never commit `.env`, secret keys, payment keys or participant data.
- Rate-limit hashes are HMACs; raw IP addresses are not stored. Rate-limit thresholds are initial defaults and should be reviewed before opening registration.
- Establish an approved retention and deletion process before collecting real participant records.

## Manual activation checklist

- [ ] Event name, dates, venue, college/unit, agenda and contacts approved
- [ ] Category names, individual/team modes, team sizes and capacities approved
- [ ] Participant fields and privacy notice approved and published at an HTTPS URL
- [ ] Supabase project and region approved
- [ ] First super-admin created securely
- [ ] Migration applied and security advisors reviewed
- [ ] Edge Function deployed and tested with synthetic data
- [ ] Public origin allowlist configured
- [ ] Browser config contains publishable key only
- [ ] Registration opened by organiser approval
