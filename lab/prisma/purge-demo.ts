/** Удаляет все демонстрационные данные перед запуском публичной версии. */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const demoUsers = await prisma.user.findMany({ where: { isDemo: true }, select: { id: true } });
  const ids = demoUsers.map((u) => u.id);
  const materials = await prisma.material.deleteMany({ where: { OR: [{ isDemo: true }, { authorId: { in: ids } }] } });
  const research = await prisma.research.deleteMany({ where: { OR: [{ isDemo: true }, { authorId: { in: ids } }] } });
  await prisma.moderationEvent.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.attachment.deleteMany({ where: { uploaderId: { in: ids } } });
  const users = await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.tag.deleteMany({ where: { materials: { none: {} } } });
  console.log(`Удалено: материалов ${materials.count}, исследований ${research.count}, демо-пользователей ${users.count}.`);
  console.log("Файлы вложений демо-пользователей в UPLOAD_DIR удалите вручную, если загружали их.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
