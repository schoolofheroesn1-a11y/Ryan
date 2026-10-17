import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { loginSchema, profileSchema, registerSchema, zodFieldErrors } from "@/lib/validation";
import { logAudit } from "./audit";
import { NotFoundError, ValidationError } from "./errors";
import { requireActor, requireAdmin, type Actor } from "./permissions";

export async function registerUser(raw: unknown) {
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Проверьте поля формы", zodFieldErrors(parsed.error));
  const { name, email, password } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new ValidationError("Пользователь с такой почтой уже зарегистрирован", { email: "Почта уже используется" });
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.create({ data: { name, email, passwordHash } });
}

// Простое ограничение попыток входа в памяти процесса.
// Для нескольких экземпляров приложения замените на Redis или ограничение на уровне прокси.
const attempts = new Map<string, { count: number; until: number }>();

export async function authenticate(raw: unknown) {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Проверьте поля формы", zodFieldErrors(parsed.error));
  const { email, password } = parsed.data;
  const state = attempts.get(email);
  if (state && state.count >= 5 && state.until > Date.now())
    throw new ValidationError("Слишком много попыток входа. Подождите 10 минут.");
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !ok) {
    const s = state && state.until > Date.now() ? state : { count: 0, until: Date.now() + 600_000 };
    s.count += 1;
    attempts.set(email, s);
    throw new ValidationError("Неверная почта или пароль");
  }
  if (user.isBlocked) throw new ValidationError("Аккаунт заблокирован администратором");
  attempts.delete(email);
  return user;
}

export async function updateProfile(actorInput: Actor | null, raw: unknown) {
  const actor = requireActor(actorInput);
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Проверьте поля профиля", zodFieldErrors(parsed.error));
  return prisma.user.update({
    where: { id: actor.id },
    data: {
      name: parsed.data.name,
      specialization: parsed.data.specialization || null,
      bio: parsed.data.bio || null,
      links: parsed.data.links,
    },
  });
}

export async function setUserRole(actorInput: Actor | null, args: { userId: string; role: Role }) {
  const actor = requireAdmin(actorInput);
  if (!["USER", "EDITOR", "ADMIN"].includes(args.role)) throw new ValidationError("Неизвестная роль");
  if (args.userId === actor.id) throw new ValidationError("Нельзя изменить собственную роль");
  const user = await prisma.user.findUnique({ where: { id: args.userId } });
  if (!user) throw new NotFoundError("Пользователь не найден");
  await prisma.user.update({ where: { id: user.id }, data: { role: args.role } });
  await logAudit(prisma, {
    actorId: actor.id,
    action: "user.role",
    targetType: "User",
    targetId: user.id,
    details: `${user.role} → ${args.role}`,
  });
}

export async function setUserBlocked(actorInput: Actor | null, args: { userId: string; blocked: boolean }) {
  const actor = requireAdmin(actorInput);
  if (args.userId === actor.id) throw new ValidationError("Нельзя заблокировать самого себя");
  const user = await prisma.user.findUnique({ where: { id: args.userId } });
  if (!user) throw new NotFoundError("Пользователь не найден");
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { isBlocked: args.blocked } }),
    ...(args.blocked ? [prisma.session.deleteMany({ where: { userId: user.id } })] : []),
  ]);
  await logAudit(prisma, {
    actorId: actor.id,
    action: args.blocked ? "user.block" : "user.unblock",
    targetType: "User",
    targetId: user.id,
  });
}
