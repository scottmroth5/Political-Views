/**
 * Editorial review of the seed questions (docs/editorial-review.md).
 *
 *   npm run review:questions                      write editorial-review.md (the review sheet)
 *   npm run review:questions -- status            counts, and questions that need review
 *   npm run review:questions -- mark <slug>...    record a review of the current wording
 *   npm run review:questions -- mark --category <category-slug>
 *   npm run review:questions -- mark <slug> --note "Balanced choices after rewording"
 *   npm run review:questions -- unmark <slug>...  withdraw a review
 *
 * Marking writes prisma/editorial-reviews.json; commit it, and seeding (locally `npm run db:seed`,
 * in production `deploy.sh seed`) sets each question's editorial status from it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  contentHash,
  questionContent,
  reviewState,
  type EditorialReview,
  type ReviewState,
} from "../prisma/editorial";
import { seedCategories, type SeedQuestion } from "../prisma/seed-data";

const REVIEWS_PATH = fileURLToPath(new URL("../prisma/editorial-reviews.json", import.meta.url));
const SHEET_PATH = fileURLToPath(new URL("../editorial-review.md", import.meta.url));
const MAX_NOTE = 200;

const LABEL: Record<ReviewState, string> = {
  reviewed: "Reviewed",
  "changed-since-review": "CHANGED SINCE REVIEW",
  "not-reviewed": "Not reviewed",
};

const CHECKLIST = [
  "The prompt is neutral: no loaded words, no assumed answer, no framing that favors a side.",
  "The choices span the reasonable positions people actually hold, including both ends and the middle.",
  "Each choice is worded as its supporters would word it, at a similar length and tone.",
  "Choices are distinct; none is a straw man or a strictly better-sounding version of another.",
  "Single vs. multi-select fits: one scale is single choice; independent approaches are multi-select.",
  "Exclusive choices (e.g. keep the current approach) really cannot be combined with the others.",
  "Each choice reads as a belief on its own (it becomes a suggested belief in the profile).",
  "Plain language at about an 8th-grade reading level; no jargon or acronyms without explanation.",
];

type ReviewFile = { $comment?: string; reviews: EditorialReview[] };

function readReviews(): ReviewFile {
  return JSON.parse(readFileSync(REVIEWS_PATH, "utf8")) as ReviewFile;
}

const allQuestions = () =>
  seedCategories.flatMap((c) => c.questions.map((q) => ({ category: c, question: q })));

function writeReviews(file: ReviewFile) {
  // Keep the file in seed order so diffs stay small and readable.
  const order = new Map(allQuestions().map(({ question }, i) => [question.slug, i]));
  file.reviews.sort((a, b) => (order.get(a.slug) ?? 1e9) - (order.get(b.slug) ?? 1e9));
  writeFileSync(REVIEWS_PATH, `${JSON.stringify(file, null, 2)}\n`);
}

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function resolveSlugs(args: string[]): SeedQuestion[] {
  const questions = allQuestions();
  const categoryIndex = args.indexOf("--category");
  if (categoryIndex >= 0) {
    const slug = args[categoryIndex + 1];
    const category = seedCategories.find((c) => c.slug === slug);
    if (!category)
      fail(
        `Unknown category "${slug ?? ""}". Categories: ${seedCategories.map((c) => c.slug).join(", ")}`,
      );
    return category.questions;
  }
  const slugs = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--note");
  if (slugs.length === 0)
    fail("Name at least one question slug (see editorial-review.md), or --category <slug>.");
  return slugs.map((slug) => {
    const found = questions.find(({ question }) => question.slug === slug);
    if (!found) fail(`Unknown question slug "${slug}".`);
    return found.question;
  });
}

function mark(args: string[]) {
  const noteIndex = args.indexOf("--note");
  const note = noteIndex >= 0 ? args[noteIndex + 1]?.trim() : undefined;
  if (noteIndex >= 0 && !note) fail("--note needs text.");
  if (note && note.length > MAX_NOTE) fail(`Keep the note under ${MAX_NOTE} characters.`);

  const file = readReviews();
  for (const q of resolveSlugs(args)) {
    const entry: EditorialReview = {
      slug: q.slug,
      contentHash: contentHash(questionContent(q)),
      reviewedOn: today(),
      ...(note ? { note } : {}),
    };
    const existing = file.reviews.findIndex((r) => r.slug === q.slug);
    if (existing >= 0) file.reviews[existing] = entry;
    else file.reviews.push(entry);
    console.log(`Reviewed: ${q.slug}`);
  }
  writeReviews(file);
  console.log("Updated prisma/editorial-reviews.json. Commit it, then reseed to apply.");
}

function unmark(args: string[]) {
  const file = readReviews();
  for (const q of resolveSlugs(args)) {
    const before = file.reviews.length;
    file.reviews = file.reviews.filter((r) => r.slug !== q.slug);
    console.log(
      before === file.reviews.length
        ? `Was not reviewed: ${q.slug}`
        : `Review withdrawn: ${q.slug}`,
    );
  }
  writeReviews(file);
}

function status() {
  const { reviews } = readReviews();
  const states = allQuestions().map(({ question }) => ({
    slug: question.slug,
    state: reviewState(question, reviews).state,
  }));
  const count = (s: ReviewState) => states.filter((x) => x.state === s).length;
  console.log(
    `${count("reviewed")} reviewed · ${count("changed-since-review")} changed since review · ${count("not-reviewed")} not reviewed (of ${states.length})`,
  );
  for (const s of states.filter((x) => x.state === "changed-since-review")) {
    console.log(`  changed since review: ${s.slug}`);
  }
  const known = new Set(states.map((s) => s.slug));
  for (const r of reviews.filter((r) => !known.has(r.slug))) {
    console.log(`  review for a question that no longer exists: ${r.slug}`);
  }
}

function sheet() {
  const { reviews } = readReviews();
  const lines: string[] = [
    "# Editorial review sheet",
    "",
    `Generated ${today()} by \`npm run review:questions\`. Regenerate after any wording change; this`,
    "file is not committed. Process and guidelines: docs/editorial-review.md.",
    "",
    "## Checklist for every question",
    "",
    ...CHECKLIST.map((c) => `- [ ] ${c}`),
    "",
    "Mark a question once it passes: `npm run review:questions -- mark <slug>`.",
    "",
  ];
  for (const category of seedCategories) {
    lines.push(`## ${category.label}`, "", `_${category.description}_`, "");
    for (const q of category.questions) {
      const { state, review } = reviewState(q, reviews);
      lines.push(
        `### ${q.prompt}`,
        "",
        `- Slug: \`${q.slug}\` · Topic: ${q.topic.label} · ${q.multiple ? "Multi-select (select all that apply)" : "Single choice"}`,
        `- Status: **${LABEL[state]}**${review ? ` (reviewed ${review.reviewedOn}${review.note ? `: ${review.note}` : ""})` : ""}`,
        "",
        ...q.choices.map(
          (c, i) =>
            `${i + 1}. ${c.label}${c.exclusive ? " _(can't be combined with other choices)_" : ""}`,
        ),
        "",
        "Always offered by the app: Not sure · Skip · optional importance (1–5)",
        ...(q.explanationPrompt ? [`Explanation prompt: “${q.explanationPrompt}”`] : []),
        "",
      );
    }
  }
  writeFileSync(SHEET_PATH, lines.join("\n"));
  console.log("Wrote editorial-review.md");
  status();
}

const [command, ...args] = process.argv.slice(2);
switch (command ?? "sheet") {
  case "sheet":
    sheet();
    break;
  case "status":
    status();
    break;
  case "mark":
    mark(args);
    break;
  case "unmark":
    unmark(args);
    break;
  default:
    fail(`Unknown command "${command}". Use: sheet (default), status, mark, unmark.`);
}
