import { expect, test } from "@playwright/test";
import { accounts, login } from "./helpers";

// Регрессии QA: ширина страниц на телефоне и планшете для обычных страниц и редакции.
for (const width of [390, 820, 1024, 1280]) {
  test(`нет горизонтальной прокрутки при ширине ${width}px (с входом администратора)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page, accounts.admin);
    for (const path of ["/", "/library", "/m/raznourovnevye-zadaniya-s-pomoschyu-ii", "/me", "/admin", "/admin/materials", "/admin/taxonomy", "/admin/users", "/admin/log"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} при ${width}px`).toBeLessThanOrEqual(0);
    }
  });
}

test("слишком большой файл отклоняется до отправки, введённые данные сохраняются", async ({ page }) => {
  await login(page, accounts.teacher, "/submit");
  await page.getByLabel("Название").fill("Проверка большого файла");
  await page.getByLabel("Приложить файл").setInputFiles({ name: "big.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(11 * 1024 * 1024, 65) });
  await expect(page.getByText("Файл больше 10 МБ")).toBeVisible();
  expect(await page.$eval("#f-file", (i) => (i as HTMLInputElement).files?.length)).toBe(0);
  await expect(page.getByLabel("Название")).toHaveValue("Проверка большого файла");
});
