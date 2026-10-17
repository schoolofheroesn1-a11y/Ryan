import Link from "next/link";
import type { PublicationStatus } from "@prisma/client";
import { DemoBadge, PublicationBadge, VerificationBadge } from "@/components/ui/badges";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { materialTypeLabels, publicationStatusLabels } from "@/lib/labels";
import { requirePageStaff } from "@/server/auth";

const statuses = Object.keys(publicationStatusLabels) as PublicationStatus[];

export default async function AdminMaterialsPage({ searchParams }: PageProps<"/admin/materials">) {
  await requirePageStaff();
  const sp = await searchParams;
  const status = statuses.find((s) => s === sp.status);
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const materials = await prisma.material.findMany({
    where: { ...(status ? { status } : {}), ...(q ? { title: { contains: q, mode: "insensitive" } } : {}) },
    orderBy: { updatedAt: "desc" },
    include: { author: { select: { name: true } } },
    take: 200,
  });
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Материалы</h1>
        <Link href="/submit" className="btn-primary btn-sm">Создать материал</Link>
      </div>
      <form className="mt-4 flex flex-wrap gap-2" method="get">
        <label className="sr-only" htmlFor="am-q">Название</label>
        <input id="am-q" name="q" defaultValue={q} placeholder="Поиск по названию" className="input max-w-xs" />
        <label className="sr-only" htmlFor="am-status">Статус</label>
        <select id="am-status" name="status" defaultValue={status ?? ""} className="input max-w-[220px]">
          <option value="">Все статусы</option>
          {statuses.map((s) => <option key={s} value={s}>{publicationStatusLabels[s]}</option>)}
        </select>
        <button className="btn-secondary" type="submit">Показать</button>
      </form>
      <div className="mt-5 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[720px] text-[14px]">
          <thead className="bg-paper text-left text-muted">
            <tr><th className="p-3 font-medium">Название</th><th className="p-3 font-medium">Статус</th><th className="p-3 font-medium">Проверка</th><th className="p-3 font-medium">Автор</th><th className="p-3 font-medium">Обновлено</th></tr>
          </thead>
          <tbody>
            {materials.map((m) => (
              <tr key={m.id} className="border-t border-line">
                <td className="p-3">
                  <Link href={`/admin/materials/${m.id}`} className="font-medium hover:text-accent">{m.title}</Link>
                  <span className="block text-[12.5px] text-muted">{materialTypeLabels[m.type]} {m.isDemo && <DemoBadge />}</span>
                </td>
                <td className="p-3"><PublicationBadge status={m.status} /></td>
                <td className="p-3"><VerificationBadge status={m.verificationStatus} size="sm" /></td>
                <td className="p-3">{m.author.name}</td>
                <td className="p-3 text-muted">{formatDate(m.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {materials.length === 0 && <p className="p-6 text-muted">Ничего не найдено.</p>}
      </div>
    </div>
  );
}
