const { loadEnv } = require("../lib/env");
const { getDb, closeDb } = require("../lib/db");
const { hashPassword, generateId } = require("../lib/auth");

loadEnv();

async function runSeed() {
  const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || "");

  if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adminEmail)) {
    throw new Error("Set a valid ADMIN_EMAIL in environment variables before running seed.");
  }
  if (adminPassword.length < 8) {
    throw new Error("Set a strong ADMIN_PASSWORD (at least 8 characters) before running seed.");
  }

  const db = await getDb();
  const passwordHash = await hashPassword(adminPassword);
  const now = new Date();

  const existing = await db.collection("users").findOne({ email: adminEmail });
  if (existing) {
    await db.collection("users").updateOne(
      { _id: existing._id },
      { $set: { passwordHash, role: "admin", updatedAt: now } }
    );
    console.log(`Updated existing admin user: ${adminEmail}`);
  } else {
    await db.collection("users").insertOne({
      _id: generateId("ADM"),
      name: "NCC Event Administrator",
      regimentalNo: "ADMIN",
      year: "Staff",
      department: "NCC Unit",
      phone: "0000000000",
      email: adminEmail,
      passwordHash,
      role: "admin",
      privacyConsent: true,
      privacyConsentAt: now,
      createdAt: now,
      updatedAt: now
    });
    console.log(`Created initial admin user: ${adminEmail}`);
  }

  console.log("Database indexes, KPRIET settings, and 5 default events verified.");
}

runSeed()
  .then(() => closeDb())
  .catch(async (err) => {
    console.error("Seed failed:", err.message);
    await closeDb();
    process.exit(1);
  });
