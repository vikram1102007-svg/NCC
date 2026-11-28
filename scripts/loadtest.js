const http = require("node:http");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { createApp } = require("../api/index");
const { setTestDb } = require("../lib/db");
const { MongoClient } = require("mongodb");

async function runLoadTest() {
  const TARGET_REGISTRATIONS = 300;
  let mongod = null;
  let client = null;
  let server = null;

  try {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "load-test-secret-key-minimum-32-chars";

    mongod = await MongoMemoryServer.create();
    client = new MongoClient(mongod.getUri());
    await client.connect();
    const db = client.db("ncc_loadtest");
    setTestDb(db);
    await require("../lib/db").getDb();

    const app = createApp({ disableRateLimit: true });
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    // Increase one test event capacity to 350 so 300 unique registrations succeed cleanly,
    // AND keep another small capacity event to verify concurrent seat cutoff too.
    await db.collection("events").updateOne({ _id: "drill" }, { $set: { capacity: 350 } });
    await db.collection("events").updateOne({ _id: "obstacle" }, { $set: { capacity: 10 } });

    const startedAt = Date.now();
    const batchSize = 30;
    let successCount = 0;

    for (let offset = 0; offset < TARGET_REGISTRATIONS; offset += batchSize) {
      const promises = [];
      for (let i = offset; i < offset + batchSize; i += 1) {
        promises.push(
          (async () => {
            const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: `Cadet Load ${i}`,
                regimentalNo: `TN/24/${1000 + i}`,
                year: "II Year",
                department: "CSE",
                phone: `98765${String(i).padStart(5, "0")}`,
                email: `load.cadet.${i}@kpriet.ac.in`,
                password: "StrongPassword123",
                privacyConsent: true
              })
            });
            if (signupRes.status !== 201) {
              throw new Error(`Signup failed for ${i}: ${signupRes.status}`);
            }
            const cookie = signupRes.headers.get("set-cookie").split(";")[0];

            const regRes = await fetch(`${baseUrl}/api/registrations`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Cookie: cookie
              },
              body: JSON.stringify({
                eventIds: ["drill"],
                teamName: `Squad-${i}`
              })
            });
            if (regRes.status !== 201) {
              const txt = await regRes.text();
              throw new Error(`Register failed for ${i}: ${regRes.status} ${txt}`);
            }
            successCount += 1;
          })()
        );
      }
      await Promise.all(promises);
    }

    // Verify concurrent overbooking cutoff: 25 concurrent attempts for 10-seat obstacle course
    const raceCookies = [];
    for (let j = 0; j < 25; j += 1) {
      const s = await fetch(`${baseUrl}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Race Cadet ${j}`,
          regimentalNo: `TN/RC/${200 + j}`,
          year: "I Year",
          department: "ECE",
          phone: `99887${String(j).padStart(5, "0")}`,
          email: `race.${j}@kpriet.ac.in`,
          password: "StrongPassword123",
          privacyConsent: true
        })
      });
      raceCookies.push(s.headers.get("set-cookie").split(";")[0]);
    }
    const raceResults = await Promise.all(
      raceCookies.map((cookie) =>
        fetch(`${baseUrl}/api/registrations`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({ eventIds: ["obstacle"] })
        }).then((r) => r.status)
      )
    );
    const raceCreated = raceResults.filter((s) => s === 201).length;
    const raceBlocked = raceResults.filter((s) => s === 409).length;

    const drillDoc = await db.collection("events").findOne({ _id: "drill" });
    const obstacleDoc = await db.collection("events").findOne({ _id: "obstacle" });
    const drillRegs = await db.collection("registrations").countDocuments({ eventId: "drill" });
    const obstacleRegs = await db.collection("registrations").countDocuments({ eventId: "obstacle" });

    const elapsedMs = Date.now() - startedAt;
    console.log(
      JSON.stringify(
        {
          targetRegistrations: TARGET_REGISTRATIONS,
          successCount,
          drillCounter: drillDoc.registeredCount,
          drillActualDocs: drillRegs,
          concurrentRaceCreated: raceCreated,
          concurrentRaceBlocked: raceBlocked,
          obstacleCounter: obstacleDoc.registeredCount,
          obstacleActualDocs: obstacleRegs,
          elapsedMs
        },
        null,
        2
      )
    );

    if (
      successCount !== TARGET_REGISTRATIONS ||
      drillDoc.registeredCount !== TARGET_REGISTRATIONS ||
      drillRegs !== TARGET_REGISTRATIONS ||
      raceCreated !== 10 ||
      raceBlocked !== 15 ||
      obstacleDoc.registeredCount !== 10 ||
      obstacleRegs !== 10
    ) {
      throw new Error("Load test integrity mismatch detected!");
    }
    console.log("LOAD_TEST_300_PASSED");
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (client) await client.close();
    if (mongod) await mongod.stop();
  }
}

runLoadTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
