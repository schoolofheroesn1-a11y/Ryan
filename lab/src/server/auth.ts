import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, deleteSession, validateSessionToken } from "./session";
import { isAdmin, isStaff } from "./permissions";

export const SESSION_COOKIE = "pl_session";

export const getCurrentUser = cache(async () => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(token);
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function signIn(userId: string) {
  const { token, expiresAt } = await createSession(userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function signOut() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);
  store.delete(SESSION_COOKIE);
}

/** Для страниц: перенаправляет на вход, если пользователь не авторизован. */
export async function requirePageUser(next: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requirePageStaff() {
  const user = await requirePageUser("/admin");
  if (!isStaff(user)) redirect("/forbidden");
  return user;
}

export async function requirePageAdmin() {
  const user = await requirePageUser("/admin");
  if (!isAdmin(user)) redirect("/forbidden");
  return user;
}
