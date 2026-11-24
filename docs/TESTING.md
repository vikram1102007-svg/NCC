# Testing and continuous integration

## Local checks

Requirements: Node.js 20 or later.

- `npm test` runs the built-in Node.js test runner; no third-party test dependency is required.
- `npm run check` checks JavaScript syntax and runs the tests.

## Current smoke-test coverage

- Document language, viewport metadata and landmark structure.
- Internal navigation links resolve to existing section IDs.
- Two-day agenda and activity placeholder content is present.
- Registration remains closed and no participant form is exposed by the static preview.
- FAQ disclosures and mobile/reduced-motion CSS hooks are present.
- Mobile navigation opens and closes, and the footer year is populated.

## CI

GitHub Actions runs `npm run check` on pushes to `main`, pull requests targeting `main`, and manual workflow dispatch. The workflow uses read-only repository permissions.

## Limits

These checks are not a substitute for browser/device testing, accessibility audits, security testing, backend integration tests, payment sandbox tests, or end-to-end tests. Those will be added as the corresponding features are implemented.
