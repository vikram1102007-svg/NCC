const { MongoClient } = require("mongodb");
const { loadEnv } = require("./env");
const { DEFAULT_EVENTS, DEFAULT_SETTINGS } = require("./defaults");

loadEnv();

// Reuse MongoDB client across warm Vercel serverless invocations.
const globalCache = globalThis;
if (!globalCache.__nccMongoState) {
  globalCache.__nccMongoState = {
    clientPromise: null,
    db: null,
    initDone: false,
    initPromise: null,
    overrideDb: null
  };
}

function getDatabaseName(uri) {
  try {
    const parsed = new URL(uri);
    const dbName = parsed.pathname.replace(/^\//, "").trim();
    return dbName || "ncc_kpriet";
  } catch {
    return "ncc_kpriet";
  }
}

async function ensureIndexesAndDefaults(db) {
  if (globalCache.__nccMongoState.initDone) return;
  if (globalCache.__nccMongoState.initPromise) {
    return globalCache.__nccMongoState.initPromise;
  }

  globalCache.__nccMongoState.initPromise = (async () => {
    const users = db.collection("users");
    const registrations = db.collection("registrations");
    const settings = db.collection("settings");
    const events = db.collection("events");

    await Promise.all([
      users.createIndex({ email: 1 }, { unique: true, name: "uniq_user_email" }),
      registrations.createIndex(
        { userId: 1, eventId: 1 },
        {
          unique: true,
          partialFilterExpression: { active: true },
          name: "uniq_active_user_event"
        }
      ),
      registrations.createIndex({ token: 1 }, { unique: true, name: "uniq_reg_token" }),
      registrations.createIndex(
        { certificateId: 1 },
        {
          unique: true,
          partialFilterExpression: { certificateId: { $type: "string" } },
          name: "uniq_cert_id"
        }
      ),
      registrations.createIndex({ eventId: 1, status: 1 }, { name: "idx_event_status" })
    ]);

    await settings.updateOne(
      { _id: DEFAULT_SETTINGS._id },
      { $setOnInsert: { ...DEFAULT_SETTINGS, updatedAt: new Date() } },
      { upsert: true }
    );

    const existingEventsCount = await events.countDocuments();
    if (existingEventsCount === 0) {
      const now = new Date();
      await events.insertMany(DEFAULT_EVENTS.map((ev) => ({ ...ev, updatedAt: now })));
    } else {
      // Ensure the firing activity never loses its "subject to approvals" lock.
      await events.updateOne(
        { _id: "firing" },
        {
          $set: {
            registrationOpen: false,
            requiresApproval: true,
            statusLabel: "Subject to approvals"
          }
        }
      );
    }

    globalCache.__nccMongoState.initDone = true;
  })().finally(() => {
    globalCache.__nccMongoState.initPromise = null;
  });

  return globalCache.__nccMongoState.initPromise;
}

async function getDb() {
  if (globalCache.__nccMongoState.overrideDb) {
    await ensureIndexesAndDefaults(globalCache.__nccMongoState.overrideDb);
    return globalCache.__nccMongoState.overrideDb;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is missing.");
  }

  if (!globalCache.__nccMongoState.clientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000
    });
    globalCache.__nccMongoState.clientPromise = client.connect().catch((err) => {
      globalCache.__nccMongoState.clientPromise = null;
      throw err;
    });
  }

  const client = await globalCache.__nccMongoState.clientPromise;
  const db = client.db(getDatabaseName(uri));
  await ensureIndexesAndDefaults(db);
  return db;
}

// Used by automated tests to attach an isolated in-memory MongoDB database.
function setTestDb(db) {
  globalCache.__nccMongoState.overrideDb = db;
  globalCache.__nccMongoState.initDone = false;
  globalCache.__nccMongoState.initPromise = null;
}

async function closeDb() {
  if (globalCache.__nccMongoState.clientPromise) {
    try {
      const client = await globalCache.__nccMongoState.clientPromise;
      await client.close();
    } catch {
      // Ignore close errors during shutdown.
    }
  }
  globalCache.__nccMongoState.clientPromise = null;
  globalCache.__nccMongoState.initDone = false;
}

module.exports = { getDb, setTestDb, closeDb, ensureIndexesAndDefaults };
