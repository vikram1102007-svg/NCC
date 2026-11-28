# KPRIET NCC Two-Day Event — Production Setup & Event-Day Runbook

## 1. Environment Variables
Copy `.env.example` to `.env` locally (never commit `.env`), and set the exact same variables in **Vercel → Project Settings → Environment Variables**:

- `MONGODB_URI`: Connection string from MongoDB Atlas (`mongodb+srv://<app_user>:<password>@<cluster>.mongodb.net/ncc_kpriet?retryWrites=true&w=majority`).
- `JWT_SECRET`: Long random string (32+ characters) to sign `httpOnly` login cookies.
- `ADMIN_EMAIL`: Organiser / ANO login email (used only by `npm run seed`).
- `ADMIN_PASSWORD`: Strong initial organiser password (at least 8–12 mixed characters, used only by `npm run seed`).

---

## 2. MongoDB Atlas Free Tier (M0) Setup
1. Sign in to MongoDB Atlas (free tier) and create a **M0 Sandbox** cluster.
2. **Database Access (App User)**:
   - Create an application database user with **Read and write to any database** (or `readWrite` on `ncc_kpriet`). Use this username/password in `MONGODB_URI`.
3. **Database Access (Separate Read-Only Viewer User)**:
   - Under **Security → Database Access → Add New Database User**, select **Password** authentication, choose built-in role **Only read any database** (`readAnyDatabase`) or `read` on `ncc_kpriet`. Use this user strictly for inspecting records safely without risk of accidental edits.
4. **Network Access**:
   - Under **Security → Network Access → Add IP Address**, allow `0.0.0.0/0` (required for Vercel serverless functions whose outbound IPs rotate).
5. **View Live Data**:
   - In Atlas Dashboard, click **Database → Browse Collections → `ncc_kpriet`**. You will see `settings`, `events`, `users`, and `registrations`.

---

## 3. Initial Admin Seed & Deploy
1. Push your branch to GitHub (`main`) — Vercel auto-deploys from GitHub.
2. Add `MONGODB_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` in Vercel Environment Variables, then click **Redeploy** so the live serverless functions pick up the variables.
3. Run the initial seed once from your computer with `.env` pointing to your Atlas `MONGODB_URI`:
   ```bash
   npm install
   npm run seed
   ```
   This creates database indexes (`users.email` unique, `registrations(userId, eventId)` unique for active rows, `registrations.token` unique, `registrations.certificateId` unique), seeds default KPRIET settings and the 5 events (with `Firing` locked as `Subject to approvals`), and creates your first Admin user.

---

## 4. Database Backups (`npm run backup` & `mongodump`)
Because MongoDB Atlas M0 free tier does not include automated cloud backups:

1. **JSON + CSV Backup (included script)**:
   ```bash
   npm run backup
   ```
   This exports `settings.json`, `events.json`, `users.json` (password hashes omitted), `registrations.json`, and `registrations.csv` into `backups/<timestamp>/`. Note `backups/` is gitignored so student data is never committed.
2. **Full Binary Backup (`mongodump`)**:
   Install MongoDB Database Tools and run:
   ```bash
   mongodump --uri="$MONGODB_URI" --out=./backups/mongodump-$(date +%F)
   ```

---

## 5. Placeholders You Must Replace Before Launch
- **Logos**: Replace the placeholder `KPRIET Logo` and `NCC Logo` `<span class="logo-slot">` boxes in the headers (`*.html`) and hero (`index.html`) with your approved `<img>` college & NCC emblems.
- **Settings (via Admin Portal → Event Settings)**:
  - Real event dates (`datesText`)
  - Real campus venue (`venueText`)
  - Coordinator name, official phone number, and official email (`contactName`, `contactPhone`, `contactEmail`)
  - Certificate signatories (`signatoryLeft` = Associate NCC Officer name/rank, `signatoryRight` = Senior Under Officer / Principal name)
- **Events (via Admin Portal → Manage Events)**: Update exact times, venues, descriptions, and seat capacities. (`Firing` stays locked as `"Subject to approvals"` until formally approved.)

---

## 6. Event-Day Readiness Checklist
- [ ] Strong `ADMIN_PASSWORD` and 32+ char `JWT_SECRET` active on Vercel; demo/test accounts removed.
- [ ] `npm run backup` run the night before AND right before gates open; keep `registrations.csv` offline on the officer's laptop/phone.
- [ ] Two-phone test completed on the live Vercel URL (Phone 1 signs up, registers, downloads QR pass; Phone 2 signs into `admin.html`, scans QR, verifies green **Valid** and red **Invalid or already used**, checks `certificate.html?id=...`).
- [ ] Printed QR poster linking to `https://<your-vercel-domain>/register.html` tested with both an iPhone camera and an Android camera.
- [ ] MongoDB Atlas and Vercel dashboards bookmarked on officer phone/laptop.
- [ ] **Slow/Outage Fallback**: If campus Wi-Fi drops or Atlas is temporarily slow, open the pre-exported `registrations.csv` spreadsheet from `npm run backup` / Admin **Export CSV**, tick attendance offline against Reference IDs (`NCC-...`), and sync checkboxes later in `admin.html` once back online.

---

## 7. Known Free-Tier Limitations
- **MongoDB Atlas M0**: 512 MB storage limit, shared CPU/RAM, max 500 concurrent connections (`maxPoolSize: 10` configured per warm function).
- **Vercel Hobby**: 10-second serverless function timeout and occasional 1–2s cold starts on first API request after idle periods.
- **No Email Server**: Password resets cannot be emailed automatically; officers reset forgotten participant passwords inside **Admin → Reset Password**.
