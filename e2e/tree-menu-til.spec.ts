import test from "./next-fixture";
import { expect } from "@playwright/test";

test("today i learned parent expands to show nested children", async ({
  page,
  url,
}) => {
  await page.goto(url);

  const treeMenu = page.locator(".dendron-tree-menu");
  await expect(treeMenu).toBeVisible();

  const parent = treeMenu.getByText("Today I Learned", { exact: true });
  await parent.click();

  await expect(treeMenu.getByText("Golang", { exact: true })).toBeVisible();
  await expect(treeMenu.getByText("Coding", { exact: true })).toBeVisible();

  await parent.click();

  await expect(treeMenu.getByText("Golang", { exact: true })).not.toBeVisible();
  await expect(treeMenu.getByText("Coding", { exact: true })).not.toBeVisible();
});

test("today i learned route loads with its subtree open", async ({
  page,
  url,
}) => {
  await page.goto(`${url}/til`);

  const treeMenu = page.locator(".dendron-tree-menu");
  await expect(treeMenu).toBeVisible();
  await expect(treeMenu.getByText("Golang", { exact: true })).toBeVisible();
  await expect(treeMenu.getByText("Coding", { exact: true })).toBeVisible();
});
