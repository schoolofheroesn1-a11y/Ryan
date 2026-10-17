import { prisma } from "@/lib/db";
import { canonicalMime, sniffMatches, validateAttachment } from "@/lib/validation";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { canEditMaterial, canViewMaterial, requireActor, type Actor } from "./permissions";
import { getFile, putFile, removeFile } from "./storage";

export const MAX_ATTACHMENTS = 5;

export async function addAttachment(actorInput: Actor | null, args: { materialId: string; file: File }) {
  const actor = requireActor(actorInput);
  const material = await prisma.material.findUnique({
    where: { id: args.materialId },
    include: { _count: { select: { attachments: true } } },
  });
  if (!material) throw new NotFoundError("Материал не найден");
  if (!canEditMaterial(actor, material)) throw new ForbiddenError();
  if (material._count.attachments >= MAX_ATTACHMENTS)
    throw new ValidationError(`Можно приложить не больше ${MAX_ATTACHMENTS} файлов`);
  const error = validateAttachment(args.file);
  if (error) throw new ValidationError(error, { file: error });
  const mime = canonicalMime(args.file.name)!;
  const bytes = new Uint8Array(await args.file.arrayBuffer());
  if (!sniffMatches(mime, bytes.subarray(0, 8)))
    throw new ValidationError("Содержимое файла не соответствует его типу", { file: "Файл повреждён или имеет неверное расширение" });
  const key = await putFile(bytes);
  const safeName = args.file.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 150);
  return prisma.attachment.create({
    data: {
      materialId: material.id,
      uploaderId: actor.id,
      fileName: safeName,
      storageKey: key,
      mimeType: mime,
      size: bytes.byteLength,
    },
  });
}

export async function removeAttachment(actorInput: Actor | null, id: string) {
  const actor = requireActor(actorInput);
  const attachment = await prisma.attachment.findUnique({ where: { id }, include: { material: true } });
  if (!attachment) throw new NotFoundError();
  if (!canEditMaterial(actor, attachment.material)) throw new ForbiddenError();
  await prisma.attachment.delete({ where: { id } });
  await removeFile(attachment.storageKey);
}

/** Возвращает файл, только если пользователь имеет право видеть материал. */
export async function readAttachment(actor: Actor | null, id: string) {
  const attachment = await prisma.attachment.findUnique({ where: { id }, include: { material: true } });
  if (!attachment || !canViewMaterial(actor, attachment.material)) return null;
  const data = await getFile(attachment.storageKey);
  if (!data) return { attachment, data: null };
  return { attachment, data };
}
