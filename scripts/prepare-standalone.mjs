#!/usr/bin/env node
// Copies the static assets next to the standalone server, as the Dockerfile does, so
// `node .next/standalone/server.js` serves a complete app locally and in CI.
import { cpSync, existsSync } from "node:fs";

if (!existsSync(".next/standalone/server.js")) {
  console.error("No standalone build found. Run `npm run build` first.");
  process.exit(1);
}
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
