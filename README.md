# Political Views

A privacy-conscious, politically neutral web app that helps people discover, clarify and own a
structured profile of their political beliefs. **Phase 1 does not recommend candidates or compute
match scores.**

- Spec: [`Political_Views_App_Claude_Code_Implementation_PRD.docx`](Political_Views_App_Claude_Code_Implementation_PRD.docx)
- Plan and next tickets: [`docs/roadmap.md`](docs/roadmap.md)
- Decisions and assumptions: [`docs/decisions.md`](docs/decisions.md)

## What works today

- Anonymous start (no email), with a server-issued, hashed, HttpOnly session cookie
- Welcome page with privacy notice and both modes (**Guide Me**, **Let's Talk**)
- Guided mode: 24 seeded questions across 12 issue areas; answer, "not sure", skip, optional
  explanation and importance (1–5); answers persist and resume on the same device
- Mode switching that keeps all answers; session deletion that removes all data

**Not built yet (labeled in the UI, not simulated):** open conversation / AI extraction, belief
review, profile preview, accounts, export. Seeded questions are DRAFT pending editorial review.

## Prerequisites

- Node.js 22+
- Docker (for local Postgres) — or any Postgres 16 you point `DATABASE_URL` at

## Local setup

```bash
npm install                  # also generates the Prisma client
cp .env.example .env         # local defaults work with docker-compose
npm run db:up                # Postgres 16 on localhost:5433 (+ a _test database)
npm run db:deploy            # apply migrations
npm run db:seed              # load the 12 categories / 24 questions
npm run dev                  # http://localhost:3000
```

On Windows PowerShell use `Copy-Item .env.example .env` instead of `cp`.

## Commands

| Command                           | What it does                                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Development server                                                                                                          |
| `npm run build` / `npm start`     | Production build / serve                                                                                                    |
| `npm run lint`                    | ESLint (bans `console` outside the redacting logger)                                                                        |
| `npm run typecheck`               | `tsc --noEmit`                                                                                                              |
| `npm run format` / `format:check` | Prettier                                                                                                                    |
| `npm test`                        | Unit tests (no database)                                                                                                    |
| `npm run test:integration`        | API + database tests against `TEST_DATABASE_URL` (needs `db:up`)                                                            |
| `npm run check`                   | format check + lint + typecheck + unit tests                                                                                |
| `npm run db:migrate`              | Create/apply a migration after editing `prisma/schema.prisma`                                                               |
| `npm run db:reset`                | Drop, re-migrate and re-seed the dev database                                                                               |
| `npm run sessions:purge`          | Delete expired anonymous sessions and their data                                                                            |
| `npm run test:e2e`                | Playwright + axe on the production build (`npm run build` first; needs `db:up`; one-time `npx playwright install chromium`) |
| `npm run check:secrets`           | Secret/personal-data check of staged files (runs as the pre-commit hook; `-- --all` for every file)                         |

CI (`.github/workflows/ci.yml`) runs npm audit, the secret check, format, lint, typecheck, unit
and integration tests, a production build, Playwright end-to-end with axe accessibility checks, an
OWASP ZAP active scan of the CI-run app, gitleaks over the full history, Trivy config scan,
ShellCheck and CodeQL. A push to `main` that passes deploys automatically to
https://views.scottmroth.com (`.github/workflows/deploy.yml`).

**Pre-commit hook:** `npm install` turns it on. To block your own personal terms (e.g. a work email)
too, list them one per line in `.personal-terms` (git-ignored, never committed).

## Deployment

Production is one AWS Lightsail server running `deploy/compose.yml` (Caddy HTTPS, the app, and
Postgres with TLS required), with age-encrypted nightly backups. Setup, encryption details, DNS
(Porkbun), PostHog and launch gates: [`docs/deployment-plan.md`](docs/deployment-plan.md).

## Project layout

```
src/app/            routes: welcome, /discovery/{guided,conversation}, /privacy, /api/*
src/components/     onboarding/, discovery/
src/domain/         sessions/, questions/, responses/ — business logic + Prisma repositories
src/lib/            env, db client, http helpers (CSRF/body limits), cookies, redacting logger,
                    allowlisted analytics
src/middleware.ts   per-request nonce Content-Security-Policy
prisma/             schema, migrations, seed data (seed-data.ts) and idempotent seeder
tests/unit/         pure logic
tests/integration/  route handlers against a real test database
tests/e2e/          Playwright + axe against the production build
deploy/             production compose stack, Caddyfile, Postgres TLS config, server scripts
docs/               decisions.md, roadmap.md, deployment-plan.md
```

## API (implemented)

| Endpoint                       | Behavior                                                   |
| ------------------------------ | ---------------------------------------------------------- |
| `POST /api/sessions`           | Create anonymous session + cookie (reuses an active one)   |
| `GET /api/sessions/current`    | Session, mode and progress                                 |
| `PATCH /api/sessions/current`  | Change mode                                                |
| `DELETE /api/sessions/current` | Delete session and all associated data                     |
| `GET /api/questions/next`      | Next eligible curated question (or `null`) + progress      |
| `POST /api/responses`          | Save/edit a guided answer, idempotent via `idempotencyKey` |

Errors use `{ "error": { "code", "message", "details?" } }` and never echo submitted content.

## Privacy rules for contributors

- Never log, send to analytics, or put in error messages any user response content.
- Never commit real secrets or real political conversation transcripts; use synthetic fixtures.
- Don't add candidate matching, persuasion or targeting features (PRD §10, §13).
