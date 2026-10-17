import { expect, test } from "@playwright/test";

test("1. гость находит материал через поиск по задаче", async ({ page }) => {
  await page.goto("/");
  await page.locator("#search-lg").fill("рефлексия");
  await page.getByRole("button", { name: "Найти" }).first().click();
  await expect(page).toHaveURL(/\/library\?q=/);
  await expect(page.getByText(/найдено \d+ материал/)).toBeVisible();
  await page.getByRole("link", { name: /Рефлексия за пять минут/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Рефлексия за пять минут/);
});

test("2. гость применяет несколько фильтров и сбрасывает их", async ({ page }) => {
  await page.goto("/library");
  const total = await page.locator("#results-heading").innerText();
  const panel = page.getByTestId("filters-desktop");
  await panel.getByLabel("Педагогическая задача").selectOption("assessment");
  await expect(page).toHaveURL(/task=assessment/);
  await panel.getByRole("checkbox", { name: "Бесплатно", exact: true }).check();
  await expect(page).toHaveURL(/cost=FREE/);
  await panel.getByLabel("Класс").selectOption("3");
  await expect(page).toHaveURL(/grade=3/);
  await expect(page.locator("#results-heading")).not.toHaveText(total);
  await expect(page.getByText("Сбросить фильтры (3)")).toBeVisible();
  await page.getByTestId("reset-filters").click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.locator("#results-heading")).toHaveText(total);
});

test("10a. пустой результат поиска показывает понятное состояние", async ({ page }) => {
  await page.goto("/library?q=квантовая%20телепортация%20xyz");
  await expect(page.getByRole("heading", { name: "Подходящих материалов нет" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Очистить поиск" })).toBeVisible();
});

test("3. копирование инструкции и ссылки на странице материала", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/m/raznourovnevye-zadaniya-s-pomoschyu-ii");
  await page.getByRole("button", { name: "Копировать инструкцию" }).click();
  await expect(page.getByRole("button", { name: "Скопировано" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("1. Выберите фрагмент");
  await page.evaluate(() => Object.defineProperty(navigator, "share", { value: undefined }));
  await page.getByRole("button", { name: "Поделиться ссылкой" }).click();
  await expect(page.getByText("Ссылка скопирована")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/m\/raznourovnevye-zadaniya-s-pomoschyu-ii$/);
  await page.getByRole("button", { name: "Копировать промпт" }).first().click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Составь задания трёх уровней");
});

test("исследование показывает оценки по критериям и критическую ошибку", async ({ page }) => {
  await page.goto("/research/generatsiya-testov-po-tekstu-paragrafa");
  await expect(page.getByText("Учебный пример — испытание не проводилось")).toBeVisible();
  const table = page.getByRole("region", { name: "Таблица результатов испытания" });
  await expect(table.getByText("Нельзя использовать без устранения критической ошибки")).toBeVisible();
  await expect(table.getByRole("rowheader", { name: /Фактическая точность ответов/ })).toBeVisible();
});

test("8. гость не получает доступ к приватным разделам и неопубликованным материалам", async ({ page, request }) => {
  await page.goto("/me");
  await expect(page).toHaveURL(/\/login\?next=%2Fme/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
  const pending = await request.get("/m/minutka-chteniya-s-voprosom-k-avtoru");
  expect(pending.status()).toBe(404);
  const att = await request.get("/api/attachments/does-not-exist");
  expect(att.status()).toBe(404);
});
