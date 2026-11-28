const fs = require("node:fs");
const path = require("node:path");

/**
 * Loads key=value pairs from a local .env file into process.env if present.
 * Already-set environment variables (like on Vercel or in tests) always take precedence.
 */
function loadEnv(envPath = path.resolve(process.cwd(), ".env")) {
  try {
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = val;
      }
    }
  } catch {
    // Ignore missing or unreadable .env files in serverless environments.
  }
}

module.exports = { loadEnv };
