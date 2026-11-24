# Decision log

## 2026-11-24 — Initial repository baseline
- Use dedicated repository vikram1102007-svg/NCC; do not create or modify unrelated repositories.
- Start with a static public event-information page. This avoids inventing official event facts or collecting personal data before a secure backend exists.
- Use a restrained navy/olive visual direction provisionally; replace branding only with organiser-approved assets.
- Dates, venue, college/unit, eligibility, categories, rules, fees, contacts and official marks remain editable placeholders.
- No live payment gateway is selected. The user has indicated Razorpay permission is not acceptable; gateway choice must be confirmed with the institution. An officially authorised manual UPI QR plus manual verification can be considered, but must not be treated as automatically verified.
- Supabase/PostgreSQL is the preferred backend candidate, pending project availability, tooling instructions and security review.
- Use Node.js built-in test runner without runtime dependencies for the static-site smoke suite; GitHub Actions is the first CI gate.
