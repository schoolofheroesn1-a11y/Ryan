import { expect, test } from "@playwright/test";

for (const path of ["/", "/library", "/m/kriterialnaya-tablitsa-dlya-proekta", "/research/generatsiya-testov-po-tekstu-paragrafa", "/methodology", "/submit"]) {
  test(`мобильная версия ${path}: нет горизонтальной прокрутки`, async ({ page }) => {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("мобильное меню и фильтры работают", async ({ page }) => {
  await page.goto("/library");
  await page.getByText("Меню").click();
  await expect(page.getByRole("navigation", { name: "Мобильная навигация" })).toBeVisible();
  await page.getByText("Меню").click();
  await page.locator("summary", { hasText: "Фильтры" }).click();
  await page.getByLabel("Предмет").first().selectOption("math");
  await expect(page).toHaveURL(/subject=math/);
});
