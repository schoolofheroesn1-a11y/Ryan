import Link from "next/link";
import { resolveReportAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ui/action-form";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { reportReasonLabels, reportStatusLabels } from "@/lib/labels";
import { requirePageStaff } from "@/server/auth";

export default async function AdminReportsPage() {
  await requirePageStaff();
  const [open, closed] = await Promise.all([
    prisma.report.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "asc" }, include: { reporter: { select: { name: true } }, material: { select: { id: true, title: true, slug: true } } } }),
    prisma.report.findMany({ where: { status: { not: "OPEN" } }, orderBy: { resolvedAt: "desc" }, take: 20, include: { material: { select: { title: true, slug: true } }, resolvedBy: { select: { name: true } } } }),
  ]);
  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold">Жалобы и сообщения об ошибках</h1>
      <div className="mt-6 flex flex-col gap-3">
        {open.length === 0 ? <EmptyState title="Открытых жалоб нет" /> : open.map((r) => (
          <article key={r.id} className="card p-5">
            <p className="text-[13px] font-semibold text-danger">{reportReasonLabels[r.reason]}</p>
            {r.material && <p className="mt-1"><Link href={`/admin/materials/${r.material.id}`} className="link font-medium">{r.material.title}</Link></p>}
            <p className="mt-1 text-[13px] text-muted">{r.reporter?.name ?? "Удалённый пользователь"} · {formatDate(r.createdAt)}</p>
            <p className="mt-2 whitespace-pre-line text-[15px]">{r.body}</p>
            <ActionForm action={resolveReportAction} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="id" value={r.id} />
              <label htmlFor={`res-${r.id}`} className="sr-only">Решение</label>
              <input id={`res-${r.id}`} name="resolution" className="input" placeholder="Что сделано (например: исправлено, статус изменён на «Требует повторной проверки»)" />
              <div className="flex gap-2">
                <SubmitButton name="status" value="RESOLVED" className="btn-primary btn-sm">Решено</SubmitButton>
                <SubmitButton name="status" value="DISMISSED" className="btn-secondary btn-sm">Отклонить</SubmitButton>
              </div>
            </ActionForm>
          </article>
        ))}
      </div>
      {closed.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Недавно закрытые</h2>
          <ul className="mt-3 flex flex-col gap-2 text-[14px]">
            {closed.map((r) => (
              <li key={r.id}>{reportStatusLabels[r.status]}: {r.material?.title ?? "—"} <span className="text-muted">· {r.resolvedBy?.name} · {formatDate(r.resolvedAt)}{r.resolution && ` — ${r.resolution}`}</span></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
