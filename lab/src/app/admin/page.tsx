import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { TypeLabel } from "@/components/ui/badges";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requirePageStaff } from "@/server/auth";

export default async function AdminQueuePage() {
  await requirePageStaff();
  const queue = await prisma.material.findMany({
    where: { status: "PENDING" },
    orderBy: { updatedAt: "asc" },
    include: { author: { select: { name: true, id: true } } },
  });
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Очередь модерации</h1>
      <p className="mt-1 text-[14px] text-muted">Материалы, отправленные авторами на проверку. Старые — сверху.</p>
      <div className="mt-6">
        {queue.length === 0 ? (
          <EmptyState title="Очередь пуста">Новых материалов на проверке нет.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {queue.map((m) => (
              <li key={m.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <TypeLabel type={m.type} />
                  <p className="font-semibold">{m.title}</p>
                  <p className="text-[13px] text-muted">{m.author.name} · отправлено {formatDate(m.updatedAt)}</p>
                </div>
                <Link href={`/admin/materials/${m.id}`} className="btn-primary btn-sm">Проверить</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
