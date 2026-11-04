# Decisions log

Assumptions and choices made where the Phase 1 spec
(`Political_Views_App_Claude_Code_Implementation_PRD.docx`) left room. Newest last.
Revisit any of these by adding a new entry rather than editing history.

## D-001 — Pinned dependency majors (2026-11-03)

Latest available majors at kickoff included TypeScript 7, Prisma 7/8-rc, ESLint 10 and Vitest 5.
We pinned the latest patches of well-established majors instead: Next 15.5, React 19.2,
Prisma 6.19, Zod 4, Vitest 3.2, Tailwind 4, ESLint 9, TypeScript 5.9. Exact versions are pinned
in `package.json`. Upgrades (notably Next 16 and Prisma 7, which changes client generation and
requires driver adapters) are separate, deliberate tickets.

## D-002 — Modular monolith layout

Follows PRD §9: `src/app` (routes, thin), `src/domain/*` (business logic + repositories),
`src/lib` (cross-cutting: env, db, http, cookies, logger). Prisma is only imported from
`*-repository.ts` files and `src/lib/db.ts`. `src/services/{ai,extraction}` will be added in M3.
A `src/domain/responses` module was added (not listed in the PRD) because responses are
shared by guided and conversation modes.

## D-003 — No shadcn/ui or Playwright yet

To avoid unnecessary dependencies in the first slice, UI is plain Tailwind and E2E is deferred.
Integration tests call the real route handlers against Postgres, covering the PRD's E2E
scenarios at the API level. shadcn/ui can be introduced when component count justifies it;
Playwright smoke tests are required before beta (PRD §11).

## D-004 — Local Postgres via Docker on port 5433

`docker-compose.yml` runs Postgres 16 on host port 5433 (avoids clashing with a local 5432) and
creates a separate `political_views_test` database. Integration tests refuse to run unless the
target database name contains `test`.

## D-005 — Anonymous session token

32 random bytes (base64url) in an HttpOnly, SameSite=Lax cookie; `__Host-pv_session` (Secure)
in production, `pv_session` in development. Only the SHA-256 hash is stored. A fast hash is
appropriate because the token is high-entropy, not a password.

## D-006 — CSRF approach

Cookie auth + SameSite=Lax + JSON-only bodies (415 otherwise) + an Origin check on every
state-changing route (falls back to `Sec-Fetch-Site: same-origin`; rejects when neither is
present). No CSRF token is needed while there are no cross-site form posts.

## D-007 — Fixed 30-day expiry, deleted on sight

Expiry is fixed from creation (configurable via `SESSION_TTL_DAYS`), not sliding, so the
retention window stated to users is predictable. Expired sessions are deleted (with all data,
via cascade) the moment they are encountered, and `npm run sessions:purge` removes the rest; it
must be scheduled once deployed. Sliding expiry can be reconsidered with product input.

## D-008 — One guided response per question per session

`Response` has `@@unique([sessionId, questionId])`. Re-answering updates the same row so future
`BeliefEvidence` links stay valid; `questionVersion` records the wording the user saw. Belief
revision history (not response history) is the audit trail for interpretations (M5). Chat
messages have a null `questionId` and are unconstrained.

## D-009 — Response columns instead of a single JSON value

The PRD lists "text/choice JSON". We use typed columns (`outcome`, `choiceValue`, `text`,
`importance`) for validation and DB CHECK constraints. A skip stores no content at all
(enforced by a CHECK constraint): skipping means the user chose not to share.

## D-010 — Idempotency

`POST /api/responses` requires a client-generated UUID `idempotencyKey`, unique per session.
A retry with the same key returns the original result (`status: "replayed"`) without writing;
reusing a key for a different question returns 409.

## D-011 — Question selection (M2 subset)

Deterministic ranking implementing PRD §5 criteria (a) coverage and (e) no repeats: exclude
questions with any response, then prefer categories with the fewest responses (skips count, so a
skipped area isn't immediately re-asked), then display order. Ambiguity, user priority and
depth are M4. AI never selects questions.

## D-012 — Seeded questions are DRAFT

24 questions (2 × 12 categories) were drafted to be neutral and span a range of positions, but
are stored with `editorialStatus = DRAFT`. `REQUIRE_REVIEWED_QUESTIONS=true` (required before
beta) serves only REVIEWED questions. Editing a question's wording in the seed bumps its version
and resets it to DRAFT. A human, ideally politically diverse, editorial review is required.

## D-013 — Belief.topicId is nullable

A conversation-extracted belief may not map to a seeded topic. Nullable now; revisit in M3.

## D-014 — Redacting logger, no analytics yet

`src/lib/logger.ts` logs event names plus error name/code only, never messages or bodies
(ESLint bans `console` elsewhere). Prisma query logging is off. PostHog is not installed yet;
when added, only privacy-safe event names may be sent (PRD §10).

## D-015 — Multi-select questions (2026-11-04)

Some issues are honestly answered with a combination of approaches (e.g. climate: market tools
_and_ innovation incentives). Questions now have a per-question type:

- `MULTI_CHOICE` ("select all that apply") for "which approaches" questions where combinations
  are coherent.
- `SINGLE_CHOICE` where the choices are points on one scale (increase / keep / decrease), since
  picking several would be self-contradictory.
- A choice may be `exclusive` (e.g. "keep the current approach"): it cannot be combined with
  others. The UI clears other selections when it is picked; the API rejects the combination.

`Response.choiceValue` was replaced by `Response.choiceValues TEXT[]` (migration copies existing
answers), stored in the question's display order. Supersedes the column list in D-009.
Contradictory-looking combinations are allowed — the user's answer is theirs; M4 clarification
may ask about them neutrally, never "correct" them.

## D-016 — Added budget and civil-rights questions (2026-11-04)

At user request: three fiscal questions (deficit priority, balanced-budget amendment,
deficit-reduction approaches) in the renamed "Economy, Taxes & Budget" area, and five
civil-rights questions (LGBTQ discrimination protections, same-sex marriage, equal treatment vs.
closing outcome gaps, racial disparities, race in admissions/hiring). They stay within the 12 PRD
categories. Questions are framed around policy, not group approval, and avoid the loaded terms
"equality"/"equity" in choices by describing each concretely. Transgender-specific policy topics
(e.g. sports participation, medical care for minors) were deliberately not bundled in; each needs
its own carefully reviewed question. All new questions are DRAFT (D-012).

## D-017 — Vaccine requirement questions (2026-11-04)

Two Healthcare questions, split because many people view routine school vaccines differently from
emergency mandates: school-entry requirements (single choice, by exemption policy) and, during a
public health emergency, which settings warrant requirements (multi-select; "nowhere" is
exclusive). Total seeded questions: 34. DRAFT pending editorial review.

## D-018 — Abortion questions (2026-11-04)

Three single-choice Healthcare questions: when abortion should be legal (symmetric four-point
scale), who should set abortion law (federal protect / states / federal restrict), and public
funding (yes / only rape, incest or life of the woman / no). Labels such as "pro-life" and
"pro-choice" are avoided; each choice states a concrete policy. Placing abortion under Healthcare
(rather than Civil Rights) is itself a framing choice and is flagged for editorial review.
Total seeded questions: 37. DRAFT pending editorial review.

## D-019 — Electoral College question (2026-11-04)

One single-choice Government & Democracy question on presidential election method: national
popular vote / keep the Electoral College but change how states award electors / keep as is. The
middle option covers reformers who do not favor abolition. Total seeded questions: 38. DRAFT.
