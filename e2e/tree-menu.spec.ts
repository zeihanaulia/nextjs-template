import test from "./next-fixture";
import { expect } from "@playwright/test";

test("tree menu expands a parent into its leaf children", async ({ page, url }) => {
  await page.goto(url);

  const treeMenu = page.locator(".dendron-tree-menu");
  await expect(treeMenu).toBeVisible();

  const parent = treeMenu.getByText("Book Summaries", { exact: true });
  await parent.click();

  await expect(
    treeMenu.getByText("14 Habits of Highly Productive Developers", {
      exact: true,
    })
  ).toBeVisible();
  await expect(
    treeMenu.getByText("Building a Second Brain", { exact: true })
  ).toBeVisible();
});
