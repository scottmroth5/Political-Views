# Phase 1 milestone plan

Source spec: `Political_Views_App_Claude_Code_Implementation_PRD.docx` (§12).

| Milestone               | Status                    | Scope                                                                                                                                                   |
| ----------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1 Foundation           | **Done**                  | Next.js/TS scaffold, Postgres + Prisma schema & migrations, Docker DB, CI, lint/format/typecheck/tests                                                  |
| M2 Guided MVP           | **Done**                  | Anonymous session, onboarding with both modes, seeded taxonomy, guided answer flow (answer / not sure / skip / importance), resume, mode switch, delete |
| M3 AI + Chat            | Not started               | Provider-neutral AI adapter, schema-validated extraction, chat UI, fallback                                                                             |
| M4 Adaptive + Switching | Not started               | Ambiguity/priority/depth ranking, clarification caps, dedup across modes                                                                                |
| M5 Profile              | **Partial (guided only)** | Belief review (confirm/edit/reject), importance/conviction, early preview, coverage                                                                     |
| M6 Beta hardening       | Not started               | Security/privacy review, accessibility audit, deployment (AWS CDK), AI evals, runbook                                                                   |

## Next implementation tickets

1. **Edit previous guided answers** (US-06-10): add `GET /api/questions/:id`, a "Change" action
   in the answer history, and pre-filled form. Backend upsert already supports edits.
2. **Editorial review of seed questions**: human review of all 24 DRAFT questions for
   neutrality and balance; mark REVIEWED; set `REQUIRE_REVIEWED_QUESTIONS=true` for beta.
3. **Rate limiting** on `POST /api/sessions` and (later) AI endpoints; choose an
   implementation that works across instances (e.g. Postgres- or Redis-backed).
4. **Playwright smoke tests**: onboarding → guided answer → reload/resume → mode switch → delete.
5. **Schedule session purge** (`npm run sessions:purge`) in the deployment environment.
6. **M3: AI adapter interface** (`src/services/ai`) with env-selected provider and a fake
   provider for tests; no real provider call without approval of provider + data terms.
7. **M3: Extraction service + `POST /api/beliefs/extract`** with Zod-validated output, one retry,
   fallback to curated questions; synthetic, politically diverse evaluation fixtures.
8. **M3: Chat UI and `POST /api/responses` support for conversation messages.**
9. **M5: `GET/PATCH /api/beliefs`, `GET /api/profile`** with optimistic concurrency and
   `BeliefRevision` audit rows; confirmed beliefs never auto-modified.
10. **Accessibility pass**: automated axe checks + manual keyboard/screen-reader review (WCAG 2.2 AA).
11. **Dependency upgrades** (Next 16, Prisma 7) as separate, tested tickets (see D-001).

## Added 2026-11-04

12. **Editorial review now covers 38 questions**, including the new budget, civil-rights, vaccine, abortion and Electoral College
    questions and each question's single vs. multi-select type and exclusive choices.
13. **Consider transgender-specific policy questions** (sports participation, medical care for
    minors, documents), each as its own question, with especially careful editorial review.
14. **M4: neutral clarification for combinations that look contradictory** in multi-select
    answers (e.g. both "much stricter" and "loosen" on firearms) — ask, never correct.

## Deployment and automated testing (2026-11-04)

See [deployment-plan.md](deployment-plan.md) (Lightsail, automatic deploys). Existing automated tests: format, lint, typecheck,
51 unit and 17 integration tests, and a production build, all in CI on every push. Still to add:
npm audit, CodeQL gate, gitleaks + pre-commit hook, Playwright E2E with axe accessibility checks,
ZAP full scan against the CI-run app, Trivy image/config scans, ShellCheck, post-deploy smoke tests,
weekly ZAP passive scan of production, Dependabot, and monthly backup restore tests.

## Deployment work done (2026-11-04)

Repo-side deployment and security testing are in place (deployment-plan.md, Phase B). Remaining:

15. **Run the server setup** (deployment-plan.md Phases C–E) and the first real deploy.
16. **Editorial review tooling:** a way to mark questions REVIEWED in production (a reviewed-slugs
    list in the seed, applied by `deploy.sh seed`), since production serves only REVIEWED ones.
17. **Rate limiting** for session creation (app-level or Caddy), a launch gate.
18. **ZAP coverage:** the CI scan spiders public pages; add authenticated/API scanning of the
    session and response endpoints.
19. **Image pins updated by hand:** postgres and caddy in deploy/compose.yml and aws-cli in
    backup.sh (Dependabot covers npm, Actions and the Dockerfile base image).
20. **Runbook** (deploy, roll back, restore, rotate, incident response, data deletion requests).
21. **Dev-tool advisories (not shipped):** Vitest 3's Tinypool (critical, prototype-pollution RCE in
    worker options) and @vitest/mocker (moderate) need Vitest ≥ 4.1.12, but npm 10.9 crashes
    resolving Vitest 4's optional peers (`edgesOut` error); retry with npm 11 or Vitest 5. minimatch
    (moderate, ReDoS) is pinned by ESLint's plugins. CI's audit gate covers shipped dependencies
    only (`--omit=dev`), which are clean via the `postcss` and `deepmerge-ts` overrides in
    package.json.
22. **Next.js 16 upgrade** (removes the need for the postcss override; middleware becomes proxy).

## Deployment on hold (2026-11-05)

AWS deployment is paused to save cost; development and testing continue locally. Nothing in GitHub
needs changing: the deploy job and the production ZAP scan stay skipped while `DEPLOY_ENABLED` is
unset, and CI keeps running on every push. Tickets 15, 17 and 20 wait until deployment resumes.

### Next functionality, in order

Already done from the list above: 4 (Playwright smoke tests) and 5 (purge is scheduled by
`deploy/setup-server.sh`).

1. **Edit previous guided answers** (ticket 1): finishes M2.
2. **Profile from guided answers (M5 without AI):** turn each answer into a draft belief
   deterministically (no AI cost), then a profile page to confirm, edit or reject beliefs, set
   importance, and see coverage by category. Uses the existing Belief, BeliefEvidence and
   BeliefRevision tables.
3. **Editorial review tooling** (ticket 16) and the review itself (tickets 2 and 12), so the
   questions can be marked REVIEWED.
4. **M3 AI chat** (tickets 6–8): deferred, since a real provider costs money and needs approval of
   its data terms. The adapter and a fake provider can be built and tested for free first.

## Done 2026-11-05

- **Edit previous guided answers** (ticket 1): "Change" in the answer history reopens the question
  pre-filled (`GET /api/questions/:id`).
- **Profile from guided answers** (M5 without AI, D-023): suggested beliefs per selected choice;
  `/profile` to confirm, reword, reject and rate; coverage and gaps; `GET /api/beliefs`,
  `PATCH /api/beliefs/:id`, `GET /api/profile`. Unit, integration and Playwright tests.

Next, in order:

1. **Editorial review tooling** (ticket 16) and the review itself (tickets 2 and 12).
2. **Portable JSON export** of the profile (PRD "Download portable JSON profile").
3. **M4 selection signals:** use importance ratings and coverage gaps to rank the next question.
4. **M3 AI chat** (tickets 6–8), adapter and fake provider first; no paid provider without approval.
