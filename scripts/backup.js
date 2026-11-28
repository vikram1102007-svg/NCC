const fs = require("node:fs");
const path = require("node:path");
const { loadEnv } = require("../lib/env");
const { getDb, closeDb } = require("../lib/db");
const { buildRegistrationsCsv } = require("../lib/defaults");

loadEnv();

async function runBackup() {
  const db = await getDb();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.resolve(process.cwd(), "backups", stamp);
  fs.mkdirSync(outDir, { recursive: true });

  const [settings, events, users, registrations] = await Promise.all([
    db.collection("settings").find({}).toArray(),
    db.collection("events").find({}).toArray(),
    db.collection("users").find({}, { projection: { passwordHash: 0 } }).toArray(),
    db.collection("registrations").find({}).sort({ createdAt: -1 }).toArray()
  ]);

  fs.writeFileSync(path.join(outDir, "settings.json"), JSON.stringify(settings, null, 2));
  fs.writeFileSync(path.join(outDir, "events.json"), JSON.stringify(events, null, 2));
  fs.writeFileSync(path.join(outDir, "users.json"), JSON.stringify(users, null, 2));
  fs.writeFileSync(
    path.join(outDir, "registrations.json"),
    JSON.stringify(registrations, null, 2)
  );

  const eventsMap = {};
  events.forEach((ev) => {
    eventsMap[ev._id] = ev;
  });
  fs.writeFileSync(
    path.join(outDir, "registrations.csv"),
    buildRegistrationsCsv(registrations, eventsMap)
  );

  console.log(`Backup written to ${outDir}`);
  console.log(
    `Counts -> settings: ${settings.length}, events: ${events.length}, users: ${users.length}, registrations: ${registrations.length}`
  );
}

runBackup()
  .then(() => closeDb())
  .catch(async (err) => {
    console.error("Backup failed:", err.message);
    await closeDb();
    process.exit(1);
  });
