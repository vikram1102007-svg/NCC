const path = require("node:path");
const express = require("express");
const { loadEnv } = require("../lib/env");
const apiApp = require("../api/index");

loadEnv();

const port = Number(process.env.PORT || 3000);
const serverApp = express();
const rootDir = path.resolve(__dirname, "..");

// Mount API routes first
serverApp.use(apiApp);

// Serve static HTML/CSS/JS pages from repo root cleanly
serverApp.use(
  express.static(rootDir, {
    extensions: ["html"],
    index: "index.html"
  })
);

serverApp.use((_req, res) => {
  res.status(404).sendFile(path.join(rootDir, "404.html"));
});

serverApp.listen(port, "127.0.0.1", () => {
  console.log(`KPRIET NCC Portal running at http://127.0.0.1:${port}`);
});
