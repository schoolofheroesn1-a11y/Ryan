import { readAttachment } from "@/server/attachments";
import { getCurrentUser } from "@/server/auth";

export async function GET(_req: Request, ctx: RouteContext<"/api/attachments/[id]">) {
  const { id } = await ctx.params;
  const result = await readAttachment(await getCurrentUser(), id);
  if (!result) return new Response("Файл не найден", { status: 404 });
  if (!result.data) return new Response("Файл временно недоступен", { status: 410 });
  const { attachment, data } = result;
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(data.byteLength),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": attachment.material.status === "PUBLISHED" ? "public, max-age=300" : "private, no-store",
    },
  });
}
