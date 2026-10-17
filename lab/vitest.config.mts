import path from "node:path";
import { defineConfig } from "vitest/config";

const testDb = process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/pedlab_test";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    env: { DATABASE_URL: testDb, UPLOAD_DIR: path.resolve(import.meta.dirname, "storage/test-uploads") },
    globalSetup: ["tests/integration/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20000,
  },
});
