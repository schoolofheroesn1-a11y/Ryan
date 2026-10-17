import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Локальное хранилище вложений. Файлы лежат вне каталога public и отдаются
 * только через /api/attachments/[id] после проверки прав. Для облачного
 * развёртывания достаточно заменить эти три функции на S3-совместимый клиент.
 */
const root = () => path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || "./storage/uploads");

function resolveKey(key: string) {
  if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error("Некорректный ключ файла");
  return path.join(root(), key);
}

export async function putFile(data: Uint8Array): Promise<string> {
  const key = randomUUID();
  await mkdir(/*turbopackIgnore: true*/ root(), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ resolveKey(key), data);
  return key;
}

export async function getFile(key: string): Promise<Buffer | null> {
  try {
    return await readFile(/*turbopackIgnore: true*/ resolveKey(key));
  } catch {
    return null;
  }
}

export async function removeFile(key: string) {
  await rm(/*turbopackIgnore: true*/ resolveKey(key), { force: true });
}

export async function hasFile(key: string): Promise<boolean> {
  try {
    await stat(/*turbopackIgnore: true*/ resolveKey(key));
    return true;
  } catch {
    return false;
  }
}
