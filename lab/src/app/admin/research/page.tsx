import Link from "next/link";
import { DemoBadge, PublicationBadge } from "@/components/ui/badges";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { researchKindLabels } from "@/lib/labels";
import { requirePageStaff } from "@/server/auth";

export default async function AdminResearchList() {
  await requirePageStaff();
  const list = await prisma.research.findMany({ orderBy: { updatedAt: "desc" }, include: { _count: { select: { tools: true, criteria: true, results: true } } } });
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Исследования</h1>
        <Link href="/admin/research/new" className="btn-primary btn-sm">Новое исследование</Link>
      </div>
      <ul className="mt-6 flex flex-col gap-3">
        {list.map((r) => (
          <li key={r.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-2"><PublicationBadge status={r.status} />{r.isDemo && <DemoBadge label="Учебный пример" />}<span className="text-[13px] text-muted">{researchKindLabels[r.kind]}</span></div>
            <Link href={`/admin/research/${r.id}`} className="mt-1 block font-semibold hover:text-accent">{r.title}</Link>
            <p className="text-[13px] text-muted">
              Инструментов: {r._count.tools} · критериев: {r._count.criteria} · оценок: {r._count.results} ·{" "}
              {r.criteriaLockedAt ? `критерии зафиксированы ${formatDate(r.criteriaLockedAt)}` : "критерии не зафиксированы"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
