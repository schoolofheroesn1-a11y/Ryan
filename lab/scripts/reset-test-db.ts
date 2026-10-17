/**
 * Пересоздаёт схему тестовой базы. Из соображений безопасности работает только
 * с базами, имя которых оканчивается на _test или _e2e.
 */
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
const dbName = new URL(url).pathname.slice(1);
if (!/_(test|e2e)$/.test(dbName)) {
  console.error(`Отказ: база «${dbName}» не похожа на тестовую (ожидается суффикс _test или _e2e).`);
  process.exit(1);
}

async function main() {
  const prisma = new PrismaClient();
  await prisma.$executeRawUnsafe("DROP SCHEMA IF EXISTS public CASCADE");
  await prisma.$executeRawUnsafe("CREATE SCHEMA public");
  await prisma.$disconnect();
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
