import type { PublicationStatus, Role } from "@prisma/client";
import { ForbiddenError } from "./errors";

export type Actor = { id: string; role: Role; isBlocked: boolean };

export const isStaff = (actor: Actor | null | undefined): boolean =>
  !!actor && !actor.isBlocked && (actor.role === "EDITOR" || actor.role === "ADMIN");

export const isAdmin = (actor: Actor | null | undefined): boolean =>
  !!actor && !actor.isBlocked && actor.role === "ADMIN";

export function requireActor(actor: Actor | null | undefined): Actor {
  if (!actor) throw new ForbiddenError("Нужно войти в аккаунт");
  if (actor.isBlocked) throw new ForbiddenError("Аккаунт заблокирован");
  return actor;
}

export function requireStaff(actor: Actor | null | undefined): Actor {
  if (!actor || !isStaff(actor)) throw new ForbiddenError();
  return actor;
}

export function requireAdmin(actor: Actor | null | undefined): Actor {
  if (!actor || !isAdmin(actor)) throw new ForbiddenError("Действие доступно только администратору");
  return actor;
}

/** Опубликованное видно всем; остальное — только автору и редакции. */
export function canViewMaterial(actor: Actor | null | undefined, m: { status: PublicationStatus; authorId: string }) {
  if (m.status === "PUBLISHED") return true;
  if (!actor) return false;
  return actor.id === m.authorId || isStaff(actor);
}

/** Автор правит свой материал в любом статусе, кроме ожидающего модерации; редакция — любой. */
export function canEditMaterial(actor: Actor | null | undefined, m: { status: PublicationStatus; authorId: string }) {
  if (!actor || actor.isBlocked) return false;
  if (isStaff(actor)) return true;
  return actor.id === m.authorId && m.status !== "PENDING";
}
