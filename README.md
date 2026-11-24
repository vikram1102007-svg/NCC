# NCC Two-Day Event Management Website

A dedicated project for the college's two-day NCC event. This repository is the source of truth for application code, architecture, setup, decisions and progress reports.

> Event name, college/unit details, dates, venue, fees, eligibility, permissions, contacts and official branding are placeholders until supplied and approved. This starter does not accept registrations or payments.

## Current status
- Public mobile-first event information website: initial static milestone.
- Registration, admin portal, QR passes, attendance, database and payment gateway: planned, not connected.
- No real participant data or payment credentials are stored.

## Run locally
No build tool is required.
1. Clone this repository.
2. Open index.html in a browser, or run: python -m http.server 8000
3. Visit http://localhost:8000.

## Structure
- index.html — public event information page
- assets/styles.css — responsive styling
- scripts/app.js — accessible navigation behavior
- docs/ARCHITECTURE.md — target architecture and security
- docs/DECISIONS.md — project decisions
- docs/progress/ — dated progress reports

## Planned architecture
- Backend candidate: Supabase Auth + PostgreSQL with Row Level Security.
- Payments: institution-approved Indian gateway in sandbox first; no live processing until authorised beneficiary and credentials are confirmed.
- QR: opaque registration tokens, server validation and duplicate-scan protection.
- Hosting: dedicated NCC deployment only, after configuration and verification.

## Safety and privacy
- Never commit secrets, API keys, payment credentials, participant exports or real personal data.
- Use synthetic test records only.
- Never treat a client-side payment redirect as proof of payment.
- Enforce admin authorization server-side and with database policies.
- Collect only information required for the approved event workflow.
- Do not publish official NCC/college logos or claims without permission.

See docs/ARCHITECTURE.md and docs/DECISIONS.md. Progress reports are stored in docs/progress/.
