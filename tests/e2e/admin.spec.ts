import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN_PASSWORD } from "./admin-credentials";

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const blocking = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.help} (${v.nodes.length} element(s))`);
  expect(blocking).toEqual([]);
}

test("admin: sign in, add, copy with archive, review, archive; no editing", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/401|Unauthorized|status of 4\d\d/.test(m.text()))
      errors.push(m.text());
  });
  page.on("dialog", (d) => void d.accept());

  // Signed out: the admin page sends you to sign-in; a wrong password is refused.
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expectAccessible(page);
  await page.getByLabel("Admin password").fill("wrong password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "not correct" })).toBeVisible();
  await page.getByLabel("Admin password").fill(E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Questions" })).toBeVisible();
  await expectAccessible(page);

  // Add a question.
  const stamp = Date.now();
  const prompt = `Synthetic e2e question ${stamp}: what should be done?`;
  await page.getByRole("link", { name: "Add a question" }).click();
  await page.getByLabel("Question", { exact: true }).fill(prompt);
  await page.getByLabel("Choice 1").fill("Synthetic first option");
  await page.getByLabel("Choice 2").fill("Synthetic second option");
  await page.getByLabel("Choice 3").fill("Synthetic third option");
  await expectAccessible(page);
  await page.getByRole("button", { name: "Add question" }).click();
  await expect(page).toHaveURL(/\/admin\?show=draft$/);
  const original = page.locator("main li", { hasText: prompt });
  await expect(original.getByText("Draft", { exact: true })).toBeVisible();
  await expect(original.getByText(/^Added:/)).toBeVisible();
  // There is no way to edit or delete.
  await expect(original.getByRole("button", { name: /edit|delete/i })).toHaveCount(0);

  // Copy it, reword the copy, and archive the original in the same step.
  await original.getByRole("link", { name: "Copy" }).click();
  await expect(page.getByRole("heading", { name: "Copy a question" })).toBeVisible();
  await expect(page.getByLabel("Question", { exact: true })).toHaveValue(prompt);
  await expect(page.getByLabel("Choice 2")).toHaveValue("Synthetic second option");
  const reworded = `Synthetic e2e question ${stamp}, reworded: what should happen?`;
  await page.getByLabel("Question", { exact: true }).fill(reworded);
  await expect(page.getByLabel(/Archive the original/)).toBeChecked();
  await page.getByRole("button", { name: "Add question" }).click();
  await expect(page).toHaveURL(/\/admin\?show=draft$/);
  const copy = page.locator("main li", { hasText: reworded });
  await expect(copy.getByText(/^Copied from:/)).toBeVisible();
  await expect(
    page.locator("main li", { hasText: prompt }).filter({ hasNotText: reworded }),
  ).toHaveCount(0);

  // The original is archived, with its time, and unchanged.
  await page.getByRole("link", { name: "Archived" }).click();
  const archived = page
    .locator("main li", { hasText: prompt })
    .filter({ hasNotText: "Copied from" });
  await expect(archived.getByText("Archived", { exact: true })).toBeVisible();
  await expect(archived.getByText(/^Archived:/)).toBeVisible();
  await expect(archived.getByRole("button", { name: "Archive" })).toHaveCount(0);

  // Review the copy, then archive it (clean-up; questions are never deleted).
  await page.getByRole("link", { name: "Drafts" }).click();
  await page
    .locator("main li", { hasText: reworded })
    .getByRole("button", { name: "Mark reviewed" })
    .click();
  await page.getByRole("link", { name: "Reviewed" }).click();
  const reviewed = page.locator("main li", { hasText: reworded });
  await expect(reviewed.getByText(/^Reviewed:/)).toBeVisible();
  await reviewed.getByRole("button", { name: "Archive" }).click();
  await expect(page.locator("main li", { hasText: reworded })).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect(errors).toEqual([]);
});
