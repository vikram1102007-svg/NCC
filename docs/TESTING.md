# Testing and continuous integration

## Local checks

Requirements: Node.js 20 or later.

- `npm test` runs the built-in Node.js test runner; no third-party test dependency is required.
- `npm run check` checks the public JavaScript and shared Edge Function validation module, then runs the tests.

## Current automated coverage

- Document language, viewport metadata and landmark structure.
- Internal navigation links resolve to existing section IDs.
- Two-day agenda and activity placeholder content is present.
- Registration form is present but remains disabled by default; browser config contains no secret key.
- FAQ disclosures, mobile/reduced-motion CSS hooks and responsive registration styles.
- Mobile navigation opens and closes, and the footer year is populated.
- Registration payload normalisation and valid individual request shape.
- Invalid event/category slugs, idempotency key, contact fields and institution fields are rejected.
- Team member list length is bounded.
- Null, array and primitive JSON payloads are rejected safely; the endpoint checks object shape before reading the honeypot field.
- Registration RPC source explicitly validates the contact name.
- Migration source includes RLS, published-event policy, restricted SECURITY DEFINER RPC grants, event locking, complete event/category/hash guards and duplicate-registration uniqueness.

## CI

GitHub Actions runs `npm run check` on pushes to `main`, pull requests targeting `main`, and manual workflow dispatch. The workflow uses read-only repository permissions.

Latest verified run: [run #23](https://github.com/vikram1102007-svg/NCC/actions/runs/45460829441) on 2026-11-24, commit `cd7b0befff097d71f1b5fd8c76e73ee45bb928fa` — 14 tests passed, 0 failed. Run #21 also passed on the application-code commit before the documentation-only follow-up.

## Not yet verified

- The SQL migration has not been applied to a live NCC database.
- Edge Function TypeScript compilation/deployment and RPC behavior have not been run.
- RLS role integration, concurrent capacity/idempotency behavior, admin authorization, QR attendance, exports and payment webhooks still need integration tests.
- No browser/device end-to-end or formal accessibility audit has been run.
- The live Embarko site remains static version 1.0.0; the registration branch has not been deployed.

These checks do not guarantee zero bugs. Backend and browser tests must be added and executed before public registration opens.
