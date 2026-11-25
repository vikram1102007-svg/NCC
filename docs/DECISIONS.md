# Decision log

## 2026-11-24 — Initial repository baseline
- Use dedicated repository `vikram1102007-svg/NCC`; do not create or modify unrelated repositories.
- Start with a static public event-information page. This avoids inventing official event facts or collecting personal data before a secure backend exists.
- Use a restrained navy/olive visual direction provisionally; replace branding only with organiser-approved assets.
- Dates, venue, college/unit, eligibility, categories, rules, fees, contacts and official marks remain editable placeholders.
- No live payment gateway is selected. Razorpay has not been approved by the user; gateway choice must be confirmed with the institution.
- Supabase/PostgreSQL is the preferred backend, pending creation of an isolated NCC project.

## 2026-11-24 — Registration foundation
- Implement the first registration vertical slice on `feat/registration-foundation` for review before merge/deployment.
- Keep the browser form disabled by default. Event facts, participant fields and privacy notice must be approved before collecting real data.
- Use Supabase `@supabase/server` for the public registration Edge Function; the handler uses `auth: 'none'` because participant account creation is not required, and must enforce its own constraints.
- Keep the server-side registration enable flag false by default. Use an origin allowlist, request-size limit, honeypot, HMAC-based rate limits, payload validation, idempotency, duplicate protection and database capacity locking.
- Keep the secret key server-side only. Browser config contains only a publishable key.
- The migration enables RLS on all tables, grants public SELECT only for published event metadata/categories, and restricts SECURITY DEFINER registration/rate-limit RPCs to service_role.
- No Supabase project exists. A project creation quote of $0/month was retrieved for the connected organisation; do not create it until the user explicitly confirms.
- No payments, QR passes or admin access are enabled in this milestone.
