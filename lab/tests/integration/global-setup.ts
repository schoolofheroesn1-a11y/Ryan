import { execSync } from "node:child_process";

/** Применяет миграции к тестовой базе. Данные очищаются в самих тестах. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/pedlab_test";
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
}
