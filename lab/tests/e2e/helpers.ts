import { expect, type Page } from "@playwright/test";

export const accounts = {
  admin: { email: "admin@example.org", password: "admin-demo-password" },
  teacher: { email: "teacher@example.org", password: "teacher-demo-password" },
};

export async function login(page: Page, who: { email: string; password: string }, next = "/me") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Электронная почта").fill(who.email);
  await page.getByLabel("Пароль").fill(who.password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(new RegExp(next.replace(/[?]/g, "\\?")));
}
