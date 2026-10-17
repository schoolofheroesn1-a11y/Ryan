import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

export async function validateSessionToken(token: string) {
  if (!token || token.length > 100) return null;
  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true, isBlocked: true } } },
  });
  if (!session) return null;
  if (session.expiresAt < new Date() || session.user.isBlocked) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

export async function deleteSession(token: string) {
  await prisma.session.deleteMany({ where: { id: hashToken(token) } });
}
