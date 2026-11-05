#!/usr/bin/env node
// Turns on the repo's git hooks (.githooks/pre-commit) on `npm install`. Does nothing outside a git
// checkout (Docker builds, CI caches) and never fails the install.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".git") && existsSync(".githooks")) {
  try {
    execFileSync("git", ["config", "core.hooksPath", ".githooks"], { stdio: "ignore" });
  } catch {
    /* git not available: skip */
  }
}
