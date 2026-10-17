import { expect, test } from "@playwright/test";
import { accounts, login } from "./helpers";

test.describe.configure({ mode: "serial" });

const title = `Тестовая фишка ${Date.now()}`;

test("4. пользователь добавляет материал в избранное", async ({ page }) => {
  await login(page, accounts.teacher, "/m/svetofor-mgnovennaya-proverka-ponimaniya");
  await page.getByRole("button", { name: "☆ В избранное" }).click();
  await expect(page.getByRole("button", { name: "★ В избранном" })).toBeVisible();
  await page.goto("/me?tab=favorites");
  await expect(page.getByRole("link", { name: /Светофор/ })).toBeVisible();
});

test("10b. форма публикации показывает ошибки валидации", async ({ page }) => {
  await login(page, accounts.teacher, "/submit");
  await page.getByLabel("Тип публикации").selectOption("TIP");
  await page.getByLabel("Название").fill(title);
  await page.getByRole("button", { name: "Отправить на модерацию" }).click();
  await expect(page.getByRole("alert").first()).toContainText("Проверьте поля формы");
  await expect(page.getByText("Краткое описание: минимум 30 символов")).toBeVisible();
  await expect(page.getByLabel("Название")).toHaveValue(title);
});

test("5. автор сохраняет черновик и отправляет на модерацию", async ({ page }) => {
  await login(page, accounts.teacher, "/submit");
  await page.getByLabel("Тип публикации").selectOption("TIP");
  await page.getByLabel("Название").fill(title);
  await page.getByRole("button", { name: "Сохранить черновик" }).click();
  await expect(page).toHaveURL(/\/me\/materials\/.+\/edit\?saved=draft/);
  await expect(page.getByText("Черновик сохранён")).toBeVisible();

  await page.getByLabel("Краткое описание").fill("Ученики пишут один вопрос к теме урока, учитель отвечает на самые частые в начале следующего.");
  await page.getByLabel("Какую педагогическую задачу решает").fill("Ученики не задают вопросов, и учитель не знает, что осталось непонятным.");
  await page.getByLabel("Аудитория").fill("Учителя 5–9 классов");
  await page.locator("label.chip", { hasText: "Любой предмет" }).click();
  await page.locator("label.chip", { hasText: "Рефлексия и обратная связь" }).click();
  await page.locator("label.chip", { hasText: "Очно" }).click();
  await page.getByLabel("Шаги инструкции").fill("Раздайте карточки\nСоберите вопросы\nОтветьте на частые вопросы");
  await page.getByLabel("Время подготовки, минут").fill("5");
  await page.getByLabel("Ограничения и возможные проблемы").fill("Вопросы бывают поверхностными, покажите пример.");
  await page.getByLabel("Ожидаемый результат").fill("Список вопросов класса.");
  await page.getByLabel("Условия использования").selectOption({ index: 1 });
  await page.getByLabel("Приложить файл").setInputFiles({ name: "kartochki.txt", mimeType: "text/plain", buffer: Buffer.from("Карточка: мой вопрос к уроку") });
  await page.getByRole("button", { name: "Отправить на модерацию" }).click();
  await expect(page).toHaveURL(/\/me\?tab=publications&submitted=1/);
  await expect(page.getByText("Материал отправлен на модерацию")).toBeVisible();
  const card = page.locator("li.card", { hasText: title });
  await expect(card.locator("span", { hasText: /^На модерации$/ }).first()).toBeVisible();
});

test("9. обычный пользователь не может выполнить действие редакции", async ({ page }) => {
  await login(page, accounts.teacher);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/forbidden/);
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/forbidden/);
});

test("6–7. администратор публикует материал, он доступен в каталоге по постоянной ссылке", async ({ page, browser }) => {
  await login(page, accounts.admin, "/admin");
  await page.getByRole("listitem").filter({ hasText: title }).getByRole("link", { name: "Проверить" }).click();
  await page.getByLabel("Комментарий для автора").fill("Проверено, спасибо!");
  await page.getByRole("button", { name: "Опубликовать" }).click();
  await expect(page.getByText("Решение сохранено")).toBeVisible();

  const guest = await browser.newPage();
  await guest.goto(`/library?q=${encodeURIComponent(title)}`);
  await guest.getByRole("link", { name: title }).click();
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText(title);
  const url = guest.url();
  await expect(guest.getByText("kartochki.txt")).toBeVisible();
  const dl = await guest.request.get(await guest.getByRole("link", { name: "Скачать" }).getAttribute("href") as string);
  expect(dl.status()).toBe(200);
  expect(await dl.text()).toContain("мой вопрос");
  await guest.goto(url);
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText(title);
  await guest.close();
});

test("статус проверки нельзя повысить без выполнения критериев", async ({ page }) => {
  await login(page, accounts.admin, "/admin/materials");
  await page.getByRole("link", { name: title }).click();
  await page.getByLabel("Новый статус").selectOption("MULTI_TEACHER");
  await page.getByRole("button", { name: "Изменить статус проверки" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Нужно минимум 2 одобренных отзыва" })).toBeVisible();
});
