# Production deployment plan (AWS Lightsail + GitHub)

Status: **proposal, nothing provisioned.** Per the PRD, no paid AWS resource is created until you
approve it. Steps marked **(you)** need your accounts; **(repo)** is code written and reviewed before
anything is deployed.

Decisions (2026-11-04): URL `https://views.scottmroth.com`; cheap and simple now, following the Health-Review / Job-Agent pattern; one
production site, no demo, no hosted staging (pre-release testing is local); **deploy automatically
after CI passes on `main`**. Move to the managed design in §6 if usage grows.

---

## 1. Architecture

```
Browser ──TLS 1.2/1.3 (Let's Encrypt)──▶ Lightsail server (Ubuntu 24.04 LTS, static IP)
                                           Docker Compose:
                                             caddy  :80/:443  (only service exposed)
                                               │ private Docker network
                                             app    Next.js, non-root, read-only filesystem
                                               │ TLS required (sslmode=verify-full, own CA)
                                             db     PostgreSQL 16, data on the encrypted disk
                                           nightly: pg_dump ──age-encrypted──▶ Lightsail bucket (HTTPS)
```

| Piece     | Choice                                                                                                                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server    | Lightsail Linux, **2 GB RAM / 2 vCPU / 60 GB SSD** ($12/month, IPv4 included). 1 GB ($7) works but is tight for Postgres + Next.js                                                                          |
| Region    | `us-east-2` (Ohio), same as the other apps                                                                                                                                                                  |
| HTTPS     | Caddy, free Let's Encrypt certificates, auto-renewing, HTTP → HTTPS redirect                                                                                                                                |
| App image | Built in GitHub Actions, scanned with Trivy, published to GHCR (`ghcr.io/scottmroth5/political-views`). Code only, so a public package is fine and the server pulls without credentials                     |
| Database  | PostgreSQL 16 container on the same server, with TLS required and a volume on the server disk                                                                                                               |
| Deploy    | GitHub Actions SSHes in with a key whose `authorized_keys` line **forces** `/opt/political-views/deploy.sh`; that script can only deploy or roll back an image tag                                          |
| Backups   | Nightly `pg_dump` encrypted with **age** to a public key; the private key lives only in your password manager. Uploaded to a Lightsail object-storage bucket. Plus Lightsail automatic daily disk snapshots |
| DNS       | Porkbun (as for the other apps): `A` record `views.scottmroth.com` → the static IP                                                                                                                          |
| Retention | `sessions:purge` runs daily from cron inside the app container                                                                                                                                              |

### Encryption (the requirement: everything at rest and in transit)

| Data path / store                    | Encryption                                                                                                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser → server                     | TLS 1.2/1.3 via Caddy; HSTS header from the app                                                                                                                                                            |
| Caddy → app                          | Loopback only: Caddy shares the app container's network namespace and connects to 127.0.0.1:3000, so this hop never crosses any network (not even the Docker bridge). The app listens on loopback only     |
| App → Postgres                       | TLS required: Postgres runs with `ssl=on` and `hostssl`-only `pg_hba.conf`, certificate from a small CA generated at setup; app connects with `sslmode=verify-full`                                        |
| Server disk (database files, `.env`) | Lightsail encrypts instance disks and snapshots at rest (AWS-managed keys)                                                                                                                                 |
| Backups                              | Encrypted on the server with age before upload (only your private key can decrypt them, so a compromised server can't read old backups); the bucket is also encrypted at rest and accessed over HTTPS only |
| GitHub → server                      | SSH (key-only; passwords disabled; host key pinned in `DEPLOY_KNOWN_HOSTS`)                                                                                                                                |
| Local development                    | Your PC: use BitLocker; never copy production data locally                                                                                                                                                 |

Accepted limitation (same as Health-Review): disk encryption uses AWS-managed keys rather than a
key you control in KMS. That changes in §6.

### Server hardening

- Lightsail firewall: 80 and 443 open; 22 open for the deploy key (key-only, forced command), or
  restricted to your IP plus Lightsail's browser SSH.
- `PasswordAuthentication no`, no root login, `unattended-upgrades` with automatic reboot at
  04:30, `fail2ban` for SSH.
- Containers: non-root, `read_only`, `no-new-privileges`, `cap_drop: ALL`, memory/CPU limits, only
  Caddy publishes ports.
- `.env` is `chmod 600`, owned by the `deploy` user, never in GitHub or the image.
- Postgres is not reachable from outside the Docker network.
- Rate limiting in the app (ticket) for session creation; Caddy can add a basic per-IP limit.

### Estimated monthly cost

| Item                                                   | ≈ $/month    |
| ------------------------------------------------------ | ------------ |
| Lightsail 2 GB instance (static IP and IPv4 included)  | 12           |
| Automatic daily snapshots (7 kept, incremental)        | 1–3          |
| Lightsail object storage bucket (5 GB plan)            | 1            |
| DNS (Lightsail zone or existing registrar)             | 0            |
| GitHub Actions, GHCR, CodeQL, Dependabot (public repo) | 0            |
| **Total**                                              | **≈ $14–16** |

---

## 2. Automated testing: what exists today and what's added

**Done today, running in GitHub Actions on every push and pull request (all passing):**

- Formatting (Prettier), lint (ESLint, including a ban on raw `console`), TypeScript typecheck
- 51 unit tests: tokens, expiry, question selection, answer validation (single/multi/exclusive),
  HTTP origin checks and body limits, seed-data rules
- 17 integration tests against a real Postgres: sessions, cookies, cross-origin rejection,
  guided flow, idempotency, edits, skip/unsure, session isolation, mode switching, expiry,
  deletion cascade, multi-select rules, seeding idempotency
- Production build

**Not yet done. Added by this plan:**

| Test / scan                                                                                          | When it runs                   | Blocks deploy?              |
| ---------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------- |
| `npm audit --omit=dev --audit-level=high`                                                            | Every push                     | Yes                         |
| CodeQL `security-extended`, with a gate on open high/critical alerts (as in Health-Review)           | Every push                     | Yes                         |
| Secret and personal-data scan: gitleaks in CI, plus a pre-commit hook on your PC                     | Every push / every commit      | Yes                         |
| Dependency review                                                                                    | Pull requests                  | Yes                         |
| Playwright end-to-end: onboarding → guided (single and multi) → reload/resume → mode switch → delete | Every push                     | Yes                         |
| Accessibility: axe-core checks inside the Playwright run (WCAG 2.2 AA rules)                         | Every push                     | Yes (serious/critical)      |
| OWASP ZAP **full (active) scan** against the app running in CI containers, never production          | Every push to main             | Yes (high)                  |
| Trivy scan of the image before publishing; Trivy config scan of Dockerfile/Compose                   | Every image build / every push | Yes (fixable high/critical) |
| ShellCheck on `deploy.sh` and server scripts                                                         | Every push                     | Yes                         |
| Post-deploy smoke test: `/api/health`, welcome page, TLS and security headers                        | After every deploy             | Auto rollback               |
| OWASP ZAP **baseline (passive, no attacks)** against production                                      | Weekly                         | No, opens an issue          |
| Weekly security rebuild: newest base image, re-run checks, re-scan, deploy                           | Weekly (after Dependabot)      |                             |
| Dependabot (npm, GitHub Actions, Docker) with patch auto-merge after CI                              | Weekly                         |                             |
| Backup restore drill: decrypt the latest backup locally, restore into local Docker, run checks       | Monthly, manual on your PC     |                             |
| AI extraction evaluations (synthetic, diverse viewpoints)                                            | From Milestone 3               | Yes                         |

---

## 3. Deploy flow (automatic)

1. Push to `main` → **CI** runs all blocking checks in §2.
2. CI passes → **Deploy** workflow builds the image from that exact commit → Trivy → publish to GHCR
   as `sha-<commit>` and `latest`.
3. Deploy SSHes in; the forced command runs `deploy.sh deploy sha-<commit>`, which:
   1. pulls the image;
   2. if migrations are pending, makes an encrypted `pg_dump` backup first and stops if it fails;
   3. runs `prisma migrate deploy` from the new image;
   4. restarts the app and waits for `/api/health`;
   5. on failure, restores the pre-migration backup if needed and restarts the previous image.
4. The smoke test runs from GitHub against the production URL.
5. Manual run (Actions → Deploy → Run workflow): redeploy any published tag, or roll back.
6. Weekly security rebuild runs the same path with fresh base images.

Deploy is turned off until the server exists: repository variable `DEPLOY_ENABLED=true` switches it
on.

---

## 4. Steps, in order

### Phase A — Domain: `views.scottmroth.com` (Porkbun DNS) **(you)**

`scottmroth.com` uses Porkbun's nameservers, and the other apps are plain `A` records to Lightsail
static IPs. Do the same, **after** Phase D step 3
gives you the static IP:

1. Sign in at porkbun.com → **Account → Domain Management**.
2. On the `scottmroth.com` row, open **Details**, then click **DNS Records** (the "Edit" link next to
   DNS records).
3. Add a record:
   - **Type:** `A - Address record`
   - **Host:** `views` (Porkbun appends `.scottmroth.com`)
   - **Answer:** the Lightsail static IP, from Lightsail → Networking
   - **TTL:** `600`
4. Click **Add**. Don't add an `AAAA` record (the server is IPv4-only, like the other apps).
5. **CAA check:** if the record list has any `CAA` records, make sure one says
   `0 issue "letsencrypt.org"`, or Caddy can't get a certificate. If there are none, do nothing.
6. Verify from your PC: `Resolve-DnsName views.scottmroth.com` should return the static IP (usually
   within a few minutes).
7. Only then start the server stack (Phase E). Caddy requests the certificate on first start and
   needs the name to resolve and ports 80/443 open.

### Phase B — Repository work **(done 2026-11-04)**

1. `Dockerfile`: multi-stage Node 22 slim, standalone build, non-root, no npm in the runtime image,
   Prisma CLI under `tools/` for migrations, bundled seed/purge scripts, `HEALTHCHECK`.
2. `GET /api/health`: checks the DB connection, returns no data.
3. Security headers: HSTS (production), per-request nonce Content-Security-Policy
   (`src/middleware.ts`), `frame-ancestors 'none'`, COOP, Permissions-Policy.
4. `deploy/`: `compose.yml`, `Caddyfile`, `postgres/` (TLS-only `pg_hba.conf`, app role),
   `setup-server.sh`, `deploy.sh`, `backup.sh`, `server.env.example`.
5. Workflows: `ci.yml` (all checks in §2), `deploy.yml` (§3), `zap-production.yml`,
   `dependabot.yml` + `dependabot-automerge.yml`. Third-party actions pinned to commit SHAs.
6. `.githooks/pre-commit` → `scripts/check-secrets.mjs` (enabled by `npm install`), plus your
   git-ignored `.personal-terms` list.

Verified locally before pushing: the real `compose.yml` stack with the built image (HTTPS via Caddy,
HTTP redirect, HSTS/CSP, app port unreachable, Postgres refusing non-TLS and superuser network
logins, app connections on TLS 1.3, certificate and hostname verification enforced, migrations,
seeding, purge, age-encrypted dump), Playwright + axe, ShellCheck and Trivy config. Not yet run on a
real server: `setup-server.sh`, `deploy.sh` and `backup.sh` end to end.

### Phase C — GitHub settings **(you, about 10 minutes)**

1. **Settings → Emails:** "Keep my email addresses private" and "Block command line pushes that
   expose my email" (if not already done).
2. **Repo → Settings → Code security:** Dependabot alerts and security updates, secret scanning,
   push protection, code scanning (Advanced; the workflow configures CodeQL).
3. **Repo → Settings → Rules → New branch ruleset** for `main`: require the CI status checks,
   block force pushes and deletion.
4. **Repo → Settings → General:** allow auto-merge (for Dependabot patches).
5. **Repo → Settings → Secrets and variables → Actions**, added after Phase D:
   - Secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`
   - Variables: `DEPLOY_ENABLED=true`, `PRODUCTION_URL`

   The app's own secrets stay on the server, not in GitHub.

6. After the first image build: set the GHCR package `political-views` to Public.

### Phase D — AWS setup **(you, about 30 minutes)**

1. AWS account: root with **MFA**; an IAM Identity Center (or IAM) admin user with MFA for daily use;
   an **AWS Budget** of $25/month with email alerts.
2. **Lightsail → Create instance:** **Ohio (us-east-2)**, Linux, Ubuntu 24.04 LTS, the $12 (2 GB) plan, name
   `political-views`. Turn on **automatic snapshots** (daily).
3. **Networking:** create and attach a **static IP**. Firewall: allow 80 and 443; keep 22.
4. **DNS:** add the Porkbun `A` record for `views` → the static IP (Phase A).
5. **Object storage:** create a Lightsail bucket (5 GB plan, private), create an access key scoped
   to that bucket only, and keep it for the server's `.env`.
6. **Keys on your PC** (PowerShell; `age` from `winget install FiloSottile.age`):
   - Backup key: `age-keygen -o pv-backup.key`. Copy the whole file into your password manager,
     note the `public key: age1…` line, then delete the file.
   - Deploy key: `ssh-keygen -t ed25519 -f pv-deploy -N '""' -C github-deploy`. Keep both files
     for step 7 and Phase C.
7. **On the server** (Lightsail → instance → Connect using SSH):
   ```bash
   git clone https://github.com/scottmroth5/Political-Views.git ~/pv
   sudo bash ~/pv/deploy/setup-server.sh "<contents of pv-deploy.pub>"
   sudo nano /opt/political-views/.env   # AGE_RECIPIENT=age1…, BACKUP_* from step 5, ANALYTICS_TOKEN (Phase H)
   ```
   The script installs Docker, fail2ban and automatic updates, hardens SSH, creates the `deploy`
   user (whose key can only run `deploy.sh`), the database CA and certificates, `.env` with generated
   database passwords, and the nightly backup and purge jobs.
8. **GitHub secrets** (Phase C step 5): `DEPLOY_HOST` = static IP, `DEPLOY_USER` = `deploy`,
   `DEPLOY_SSH_KEY` = contents of `pv-deploy`, `DEPLOY_KNOWN_HOSTS` = output of
   `ssh-keyscan -t ed25519 <static-ip>`. Then delete `pv-deploy` and `pv-deploy.pub` from your PC.

### Phase E — First deployment

1. Set the variable `DEPLOY_ENABLED=true`, then run **Actions → Deploy → Run workflow** (or push to
   `main`). It builds, scans, publishes, deploys and smoke-tests.
2. Set the GHCR package `political-views` to **Public** (its package settings) if the first pull
   failed for lack of access, then run Deploy again.
3. Seed questions (server SSH): `sudo -u deploy /opt/political-views/deploy.sh seed`. With
   `REQUIRE_REVIEWED_QUESTIONS=true` only REVIEWED questions are shown, so the site shows none until
   the editorial review (Phase F and docs/editorial-review.md) marks them; that's intended.
4. Test a backup: `sudo -u deploy /opt/political-views/backup.sh`, then download it from the
   bucket and decrypt it on your PC with `age -d -i <key from password manager> file.dump.age`.
5. Verify: SSL Labs grade A for `views.scottmroth.com`; `curl -I https://views.scottmroth.com`
   shows HSTS and CSP.

### Phase F — Launch gates (from the PRD) before sharing the URL

- [ ] All seeded questions human-reviewed for neutrality and marked REVIEWED
- [ ] Privacy notice reviewed (currently labelled draft), naming AWS as hosting provider
- [ ] Every blocking check in §2 is green, including Playwright, axe and the ZAP full scan
- [ ] Session-creation rate limiting live
- [ ] First backup restore drill passed
- [ ] Daily `sessions:purge` confirmed in the logs
- [ ] Runbook written: deploy, roll back, restore, rotate secrets, incident response, delete a
      user's data on request

### Phase H — PostHog usage counts (optional) **(you, about 10 minutes)**

The app sends a handful of allowlisted counts with no SDK (`src/lib/analytics.ts`): `page_viewed`
(welcome / guided / conversation / privacy / other), `discovery_started` (mode),
`question_responded` (answered / unsure / skipped: never which question, topic or choice),
`mode_switched`, `guided_finished`, `session_deleted`. No cookies, no storage, a random id per page
load, no person profiles; Global Privacy Control or Do Not Track sends nothing. Unit tests enforce
the allowlist. Without a token nothing is sent.

1. Sign in at posthog.com (US Cloud) → **New project** named `Political Views`.
2. **Project settings → General:** turn on **Discard client IP data**. Set the timezone.
3. **Project settings:** turn **off** session replay, autocapture, heatmaps, web vitals, surveys
   and exception autocapture (the app doesn't use an SDK, but this keeps the project clean if one
   is ever added by mistake). Set **data retention** to the shortest plan option.
4. **Project settings → Project API key:** copy the **project** token (`phc_…`). Never use a
   personal API key (`phx_…`).
5. On the server: add `ANALYTICS_TOKEN=phc_…` (and keep `ANALYTICS_HOST=https://us.i.posthog.com`)
   to `/opt/political-views/.env`, then redeploy (Actions → Deploy → Run workflow) so the app picks
   it up. The CSP automatically allows only that one PostHog origin.
6. Check: open the site, then **PostHog → Activity**: you should see `page_viewed` events with
   `app = political_views` and no person profiles.
7. If you later add PostHog to another app, use a separate project.

### Phase G — Ongoing

- Weekly: Dependabot → CI → security rebuild → automatic deploy; ZAP passive scan; triage issues.
- Monthly: backup restore drill; check the AWS bill.
- Never: production data on a laptop, answers in logs, secrets in GitHub.

---

## 5. What the server never holds

GitHub tokens, AWS root/admin credentials, or the age private key. If the server is compromised,
the attacker gets the current database (encrypted disk does not help against a live intruder) but
not past backups, AWS admin access, or the ability to push code.

## 6. When usage grows: managed design

Move to ECS Fargate + RDS PostgreSQL (customer-managed KMS key, forced TLS, automated encrypted
backups) behind an ALB with AWS WAF, secrets in Secrets Manager, GitHub → AWS via OIDC, written in
AWS CDK with `cdk-nag`. About $63–76/month. Triggers to consider it: sustained traffic the 2 GB
server can't handle, a need for zero-downtime deploys or multi-AZ availability, or a requirement for
customer-managed encryption keys. The app code doesn't change (same image and database); the
migration is `pg_dump` → RDS restore and a DNS switch.
