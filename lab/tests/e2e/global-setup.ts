import { execSync } from "node:child_process";

export default function globalSetup() {
  const env = { ...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/pedlab_e2e" };
  execSync("npx tsx scripts/reset-test-db.ts", { env, stdio: "ignore" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "ignore" });
}
