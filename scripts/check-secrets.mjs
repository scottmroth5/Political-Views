#!/usr/bin/env node
/**
 * Blocks secrets and personal data from entering this PUBLIC repository.
 *
 *   node scripts/check-secrets.mjs         staged files (pre-commit hook, .githooks/pre-commit)
 *   node scripts/check-secrets.mjs --all   every tracked file (CI)
 *
 * Checks: forbidden paths (.env, keys, certificates, dumps, backups), secret shapes (cloud and
 * GitHub tokens, private keys, age secret keys, connection strings with real passwords), and, on
 * your PC only, personal terms listed one per line in the git-ignored file .personal-terms (for
 * example a work email address). Exit code 1 lists each finding with file and line, never the value.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const all = process.argv.includes("--all");

const FORBIDDEN_PATHS = [
  /(^|\/)\.env$/,
  /(^|\/)\.env\.(?!example$)[^/]+$/,
  /(^|\/)\.personal-terms$/,
  /\.(pem|key|p12|pfx|crt|csr|jks|keystore)$/i,
  /(^|\/)id_(rsa|ed25519|ecdsa)(\.pub)?$/,
  /\.(dump|age|sqlite|db|bak)$/i,
  /(^|\/)deploy\/certs\//,
];

const SECRET_SHAPES = [
  ["AWS access key id", /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["AWS secret access key", /aws_secret_access_key\s*[:=]\s*['"]?[A-Za-z0-9/+]{40}/i],
  ["GitHub token", /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ["Private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["age secret key", /AGE-SECRET-KEY-1[0-9A-Z]{50,}/],
  ["PostHog personal API key", /\bphx_[A-Za-z0-9]{20,}\b/],
  ["PostHog project token", /\bphc_[A-Za-z0-9]{20,}\b/],
  ["Anthropic/OpenAI key", /\bsk-(ant-)?[A-Za-z0-9_-]{24,}\b/],
  ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ["Stripe key", /\b(sk|rk)_live_[A-Za-z0-9]{20,}\b/],
];

// Connection strings may carry only these placeholder passwords or ${VARIABLE} references.
const PLACEHOLDER_PASSWORDS = new Set(["local_dev_password", "ci_password", "password", "pw"]);
const CONNECTION = /postgres(?:ql)?:\/\/[^:\s/]+:([^@\s]+)@/gi;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function files() {
  const out = all
    ? git(["ls-files", "-z"])
    : git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]);
  return out.split("\0").filter(Boolean);
}

function content(path) {
  try {
    const buf = all ? readFileSync(path) : execFileSync("git", ["show", `:${path}`]);
    if (buf.includes(0)) return null; // binary
    return buf.toString("utf8");
  } catch {
    return null;
  }
}

function personalTerms() {
  if (all || !existsSync(".personal-terms")) return [];
  return readFileSync(".personal-terms", "utf8")
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter((t) => t && !t.startsWith("#"))
    .map((t) => t.toLowerCase());
}

const findings = [];
const terms = personalTerms();

for (const path of files()) {
  if (FORBIDDEN_PATHS.some((re) => re.test(path))) {
    findings.push(`${path}: this kind of file must never be committed`);
    continue;
  }
  const text = content(path);
  if (text === null) continue;
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    const where = `${path}:${i + 1}`;
    for (const [label, re] of SECRET_SHAPES) {
      if (re.test(line)) findings.push(`${where}: looks like a ${label}`);
    }
    for (const m of line.matchAll(CONNECTION)) {
      const pw = m[1];
      if (!PLACEHOLDER_PASSWORDS.has(pw) && !pw.startsWith("${")) {
        findings.push(`${where}: connection string with a real-looking password`);
      }
    }
    const lower = line.toLowerCase();
    for (const term of terms) {
      if (lower.includes(term)) findings.push(`${where}: contains a term from .personal-terms`);
    }
  });
}

if (findings.length) {
  console.error("Blocked: possible secrets or personal data (this repository is public).\n");
  for (const f of findings) console.error(`  ${f}`);
  console.error("\nRemove them (or unstage the file). Values are not shown on purpose.");
  process.exit(1);
}
console.log(`check-secrets: ${all ? "all tracked" : "staged"} files clean`);
