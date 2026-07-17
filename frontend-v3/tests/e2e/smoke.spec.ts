import { expect, test } from "@playwright/test";

test("renders the v3 scaffold", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "قرار تمويلك، محسوب ومُفسَّر بالعربية" }),
  ).toBeVisible();

  await page.goto("/en");

  await expect(
    page.getByRole("heading", {
      name: /your financing decision, calculated and explained in arabic/i,
    }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByText(/simulated banking data/i)).toBeVisible();
});
