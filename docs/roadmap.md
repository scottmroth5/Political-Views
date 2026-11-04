# Phase 1 milestone plan

Source spec: `Political_Views_App_Claude_Code_Implementation_PRD.docx` (§12).

| Milestone               | Status                       | Scope                                                                                                                                                   |
| ----------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1 Foundation           | **Done**                     | Next.js/TS scaffold, Postgres + Prisma schema & migrations, Docker DB, CI, lint/format/typecheck/tests                                                  |
| M2 Guided MVP           | **Partial (vertical slice)** | Anonymous session, onboarding with both modes, seeded taxonomy, guided answer flow (answer / not sure / skip / importance), resume, mode switch, delete |
| M3 AI + Chat            | Not started                  | Provider-neutral AI adapter, schema-validated extraction, chat UI, fallback                                                                             |
| M4 Adaptive + Switching | Not started                  | Ambiguity/priority/depth ranking, clarification caps, dedup across modes                                                                                |
| M5 Profile              | Not started                  | Belief review (confirm/edit/reject), importance/conviction, early preview, coverage                                                                     |
| M6 Beta hardening       | Not started                  | Security/privacy review, accessibility audit, deployment (AWS CDK), AI evals, runbook                                                                   |

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
