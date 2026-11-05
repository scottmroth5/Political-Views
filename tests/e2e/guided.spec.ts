import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** WCAG 2.x A/AA rules; serious and critical violations fail the test. */
async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const blocking = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.help} (${v.nodes.length} element(s))`);
  expect(blocking).toEqual([]);
}

/** Collects console errors and uncaught exceptions (including CSP violations). */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

const question = (page: Page) => page.locator("#question-heading");
const isMulti = async (page: Page) => (await page.getByText("Select all that apply.").count()) > 0;

async function nextQuestionLoaded(page: Page, previous: string) {
  await expect(question(page)).not.toHaveText(previous);
}

test("welcome and privacy pages are accessible and explain data use", async ({ page }) => {
  const errors = watchErrors(page);
  const response = await page.goto("/");
  expect(response?.headers()["content-security-policy"]).toContain("'strict-dynamic'");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /Understand your own political views/,
  );
  await expect(page.getByText("No account or email is needed.", { exact: false })).toBeVisible();
  await expectAccessible(page);

  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Privacy notice" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Usage counts" })).toBeVisible();
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test("discovery pages require a session", async ({ page }) => {
  await page.goto("/discovery/guided");
  await expect(page).toHaveURL(/\/$/);
});

test("guided flow: single and multi answers, not sure, skip, resume, mode switch, delete", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Guide Me/ }).click();
  await expect(page).toHaveURL(/\/discovery\/guided$/);
  await expect(question(page)).toBeVisible();
  await expectAccessible(page);

  // 1. Answer the first single-choice and the first multi-select question we meet.
  let answeredSingle = false;
  let answeredMulti = false;
  for (let i = 0; i < 6 && !(answeredSingle && answeredMulti); i++) {
    const prompt = (await question(page).textContent()) ?? "";
    if (await isMulti(page)) {
      if (answeredMulti) {
        await page.getByRole("button", { name: "Skip" }).click();
      } else {
        const boxes = page.getByRole("checkbox");
        await boxes.nth(0).check();
        await boxes.nth(1).check();
        await expect(boxes.nth(0)).toBeChecked();
        await expect(boxes.nth(1)).toBeChecked();
        await page.getByRole("radio", { name: /3 · Moderately/ }).check();
        await page.getByRole("button", { name: "Save answer" }).click();
        answeredMulti = true;
      }
    } else if (answeredSingle) {
      await page.getByRole("button", { name: "Skip" }).click();
    } else {
      await page.getByRole("radio").first().check();
      await page.getByLabel(/in your own words/i).fill("Synthetic test explanation");
      await page.getByRole("button", { name: "Save answer" }).click();
      answeredSingle = true;
    }
    await nextQuestionLoaded(page, prompt);
  }
  expect(answeredSingle && answeredMulti).toBe(true);

  // 2. "Not sure" with no selection, then an empty "Save" shows a validation message.
  let prompt = (await question(page).textContent()) ?? "";
  await page.getByRole("button", { name: "Not sure" }).click();
  await nextQuestionLoaded(page, prompt);
  await page.getByRole("button", { name: "Save answer" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /Select/ })).toBeVisible();

  // 3. An exclusive choice clears the others (skip ahead until one appears).
  let sawExclusive = false;
  for (let i = 0; i < 40 && !sawExclusive; i++) {
    const exclusive = page.getByText("Can't be combined with other choices");
    if ((await exclusive.count()) > 0) {
      const boxes = page.getByRole("checkbox");
      const exclusiveBox = page
        .locator("label", { has: page.getByText("Can't be combined with other choices") })
        .getByRole("checkbox");
      const firstOther = page
        .locator("label", { hasNot: page.getByText("Can't be combined with other choices") })
        .getByRole("checkbox")
        .first();
      await firstOther.check();
      await exclusiveBox.check();
      await expect(exclusiveBox).toBeChecked();
      await expect(firstOther).not.toBeChecked();
      await firstOther.check();
      await expect(exclusiveBox).not.toBeChecked();
      expect(await boxes.count()).toBeGreaterThan(2);
      sawExclusive = true;
      break;
    }
    prompt = (await question(page).textContent()) ?? "";
    await page.getByRole("button", { name: "Skip" }).click();
    await nextQuestionLoaded(page, prompt);
  }
  expect(sawExclusive).toBe(true);

  // 4. Resume: a reload shows the saved answers.
  await page.reload();
  const history = page.getByRole("region", { name: "Your answers so far" });
  await expect(history).toBeVisible();
  await expect(history.getByText("Synthetic test explanation", { exact: false })).toBeVisible();
  await expect(history.getByText(/Not sure/).first()).toBeVisible();
  await expect(history.getByText(/Importance 3\/5/)).toBeVisible();
  await expectAccessible(page);

  // 5. Change an earlier answer: the form opens pre-filled, and saving replaces the answer.
  const explained = history.getByRole("listitem").filter({ hasText: "Synthetic test explanation" });
  await explained.getByRole("link", { name: /^Change/ }).click();
  await expect(page).toHaveURL(/\?edit=/);
  await expect(page.getByText("You're changing an earlier answer.")).toBeVisible();
  const explanationBox = page.getByLabel(/in your own words/i);
  await expect(explanationBox).toHaveValue("Synthetic test explanation");
  await expect(page.getByRole("radio").first()).toBeChecked();
  await expectAccessible(page);
  await explanationBox.fill("Changed synthetic explanation");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/discovery\/guided$/);
  await expect(history.getByText("Changed synthetic explanation", { exact: false })).toBeVisible();
  await expect(history.getByText("Synthetic test explanation", { exact: false })).toHaveCount(0);
  await expect(page.getByText("You're changing an earlier answer.")).toHaveCount(0);

  // 6. Mode switch keeps everything.
  await page.getByRole("button", { name: "Switch to Let's Talk" }).click();
  await expect(page).toHaveURL(/\/discovery\/conversation$/);
  await expect(page.getByText("Not available yet")).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: "Switch to Guide Me" }).click();
  await expect(page).toHaveURL(/\/discovery\/guided$/);
  await expect(history.getByText("Changed synthetic explanation", { exact: false })).toBeVisible();

  // 7. Delete removes the session and returns to the welcome page.
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Delete my session and data" }).click();
  await expect(page).toHaveURL(/\/\?deleted=1$/);
  await expect(page.getByText("Your session and all of its answers were deleted.")).toBeVisible();
  await page.goto("/discovery/guided");
  await expect(page).toHaveURL(/\/$/);

  expect(errors).toEqual([]);
});

test("profile: preview after three answers, confirm, reword, rate, reject, and answer changes", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Guide Me/ }).click();
  await expect(question(page)).toBeVisible();

  // Before enough answers, the profile explains what's needed.
  await page.getByRole("link", { name: "Your profile" }).click();
  await expect(page.getByText("Not enough answers for a preview yet")).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("link", { name: "Continue with Guide Me" }).click();

  // Answer three questions with their first choice.
  for (let i = 0; i < 3; i++) {
    const prompt = (await question(page).textContent()) ?? "";
    const first = (await isMulti(page))
      ? page.getByRole("checkbox").first()
      : page.getByRole("radio").first();
    await first.check();
    await page.getByRole("button", { name: "Save answer" }).click();
    await nextQuestionLoaded(page, prompt);
  }

  await page.getByRole("link", { name: "Your profile" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText("Preliminary and incomplete.")).toBeVisible();
  await expect(page.getByText("0 confirmed · 3 waiting for review")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Not covered yet" })).toBeVisible();
  await expectAccessible(page);

  const cards = page.locator("main li");
  // Confirm the first suggestion, then rate it.
  await cards.nth(0).getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("1 confirmed · 2 waiting for review")).toBeVisible();
  const confirmedCard = page.locator("main li", { has: page.getByLabel("Importance") });
  await confirmedCard.getByLabel("How sure you are").selectOption("4");
  await expect(confirmedCard.getByLabel("How sure you are")).toHaveValue("4");

  // Reword a suggestion: saving confirms it.
  const suggestion = page.locator("main li", {
    has: page.getByRole("button", { name: "Confirm" }),
  });
  await suggestion.first().getByRole("button", { name: "Edit wording" }).click();
  await page.getByLabel("Your belief, in your words").fill("Synthetic reworded belief");
  await page.getByRole("button", { name: "Save and confirm" }).click();
  await expect(page.getByText("Synthetic reworded belief")).toBeVisible();
  await expect(page.getByText("2 confirmed · 1 waiting for review")).toBeVisible();

  // Reject the last suggestion: it moves to the "not fitting" list.
  await suggestion.first().getByRole("button", { name: "Doesn't fit me" }).click();
  await expect(page.getByText("Marked as not fitting you (1)")).toBeVisible();
  await expect(page.getByText("2 confirmed · 0 waiting for review")).toBeVisible();
  await expectAccessible(page);

  // Change the answer behind the reworded belief: it stays, flagged for review.
  const reworded = page.locator("main li", { hasText: "Synthetic reworded belief" });
  await reworded.getByText(/^From your answer to:/).waitFor();
  await page.getByRole("link", { name: "Keep answering questions" }).click();
  const history = page.getByRole("region", { name: "Your answers so far" });
  await history
    .getByRole("link", { name: /^Change/ })
    .nth(1)
    .click();
  await expect(page.getByText("You're changing an earlier answer.")).toBeVisible();
  await page.getByRole("button", { name: "Not sure" }).click();
  await expect(page).toHaveURL(/\/discovery\/guided$/);
  await page.getByRole("link", { name: "Your profile" }).click();
  await expect(page.getByText(/no longer match|no longer matches/)).toBeVisible();
  await expect(reworded.getByText("You've changed the answer this came from.")).toBeVisible();
  await expectAccessible(page);

  expect(errors).toEqual([]);
});
