import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type Tx = Prisma.TransactionClient | typeof prisma;

export function logAudit(
  tx: Tx,
  entry: { actorId: string; action: string; targetType: string; targetId: string; details?: string },
) {
  return tx.auditLog.create({ data: { ...entry, details: entry.details ?? "" } });
}
