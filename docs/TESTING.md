# Testing and continuous integration

## Local checks

Requirements: Node.js 20 or later.

- `npm test` runs the built-in Node.js test runner.
- `npm run check` syntax-checks `ncc.js`, `scripts/app.js` and the shared registration validator, then runs all tests.

## Current coverage

- Public home document metadata, landmarks and linked pages.
- Event content keeps dates, categories and fees as pending approval; no unapproved ₹400 fee is shown.
- Registration, login, participant and admin pages remain closed until secure backend setup.
- No hardcoded admin demo credentials or browser-local storage for participant passwords/records.
- Payment page does not show fictional UPI QR or accept transaction references.
- Registration payload shape, normalisation and validation.
- Team-member bounds and malformed JSON handling.
- Registration endpoint origin allowlist, request-size cap, rate-limit secret and quota assertions.
- SQL migration source checks for RLS, restricted RPC grants, event locking, idempotency and duplicate-registration protections.
- Public browser configuration contains no service-role or server secret.

## CI

GitHub Actions runs `npm run check` on pushes and pull requests to `main`.

Main's workflow #56 failed because tests still expected the earlier page markup. This safety-fix branch updated the assertions and added security gates. PR #8 CI run #66 passed on commit `05e4999`: 22 tests passed, 0 failed.

## Not yet verified

- SQL migration has not been applied to a live NCC database.
- Edge Function deployment, RPC execution and database RLS behavior are not tested against a live project.
- Admin role authorization, QR attendance, exports and payment webhook integration are future test milestones.
- No browser/device end-to-end or formal accessibility audit has been run.
- Embarko remains the static version 1.0.0 preview; no backend changes have been deployed.

Passing unit/smoke tests does not guarantee zero bugs or production readiness.
