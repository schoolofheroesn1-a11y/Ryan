import Link from "next/link";
import { notFound } from "next/navigation";
import { moderateMaterialAction, setVerificationAction } from "@/app/actions/admin";
import { DeleteDraftButton } from "@/components/delete-draft-button";
import { ActionForm } from "@/components/ui/action-form";
import { DemoBadge, PublicationBadge, TypeLabel, VerificationBadge } from "@/components/ui/badges";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { prisma } from "@/lib/db";
import { formatDate, formatGrades, formatMinutes } from "@/lib/format";
import { publicationStatusLabels, verificationLabels, verificationOrder } from "@/lib/labels";
import { checkVerificationRequirements, verificationCriteria } from "@/lib/verification";
import { requirePageStaff } from "@/server/auth";

const decisions = {
  PENDING: [["approve", "Опубликовать", "btn-primary"], ["reject", "Отклонить с комментарием", "btn-danger"]],
  PUBLISHED: [["unpublish", "Снять с публикации", "btn-danger"]],
  UNPUBLISHED: [["republish", "Опубликовать снова", "btn-primary"]],
  DRAFT: [],
  REJECTED: [],
} as const;

export default async function AdminMaterialPage({ params, searchParams }: PageProps<"/admin/materials/[id]">) {
  await requirePageStaff();
  const { id } = await params;
  const sp = await searchParams;
  const m = await prisma.material.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, email: true, isDemo: true } },
      categories: { include: { category: true } },
      attachments: true,
      reviews: { where: { status: "APPROVED", appliedInPractice: true }, select: { authorId: true } },
      research: true,
      reports: { where: { status: "OPEN" } },
      moderationEvents: { orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!m) notFound();
  const research = await prisma.research.findMany({ where: { status: "PUBLISHED" }, select: { id: true, title: true, isDemo: true } });
  const ctx = (rid: string | null) => {
    const r = rid ? research.find((x) => x.id === rid) : null;
    return {
      isDemo: m.isDemo,
      authorId: m.authorId,
      testReport: m.testReport,
      limitations: m.limitations,
      practiceReviewAuthorIds: m.reviews.map((r) => r.authorId),
      research: m.research && m.research.id === rid ? { status: m.research.status, authorId: m.research.authorId, isDemo: m.research.isDemo, criteriaLocked: !!m.research.criteriaLockedAt } : r ? { status: "PUBLISHED", authorId: "", isDemo: r.isDemo, criteriaLocked: true } : null,
    };
  };
  const saved = typeof sp.saved === "string";
  const fileError = typeof sp.fileError === "string" ? sp.fileError : null;

  return (
    <div className="flex flex-col gap-6">
      {saved && <FormMessage ok message="Материал сохранён." />}
      {fileError && <FormMessage message={`Файл не прикреплён: ${fileError}`} />}
      <div>
        <TypeLabel type={m.type} />
        <h1 className="mt-1 font-serif text-2xl font-semibold">{m.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <PublicationBadge status={m.status} />
          <VerificationBadge status={m.verificationStatus} size="sm" />
          {m.isDemo && <DemoBadge />}
        </div>
        <p className="mt-2 text-[14px] text-muted">
          Автор: <Link href={`/authors/${m.author.id}`} className="link">{m.author.name}</Link> ({m.author.email}) · создано {formatDate(m.createdAt)} · обновлено {formatDate(m.updatedAt)}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/m/${m.slug}`} className="btn-secondary btn-sm">Просмотр страницы</Link>
          <Link href={`/me/materials/${m.id}/edit`} className="btn-secondary btn-sm">Редактировать содержание</Link>
          <DeleteDraftButton materialId={m.id} returnTo="admin" />
        </div>
      </div>

      {m.reports.length > 0 && (
        <p className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-[14px] text-danger">
          Открытых жалоб: {m.reports.length}. <Link href="/admin/reports" className="underline">Перейти к жалобам</Link>
        </p>
      )}

      <section className="card p-5" aria-labelledby="mod-h">
        <h2 id="mod-h" className="font-semibold">Публикация</h2>
        <p className="mt-1 text-[14px] text-muted">Текущий статус: {publicationStatusLabels[m.status]}. Комментарий увидит автор в личном кабинете; при отклонении и снятии он обязателен.</p>
        {decisions[m.status].length ? (
          <ActionForm action={moderateMaterialAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="id" value={m.id} />
            <label htmlFor="mod-comment" className="label">Комментарий для автора</label>
            <textarea id="mod-comment" name="comment" rows={3} className="input" placeholder="Что проверено, что нужно исправить" />
            <div className="flex flex-wrap gap-2">
              {decisions[m.status].map(([value, label, cls]) => (
                <SubmitButton key={value} name="decision" value={value} className={cls} pendingText="Сохраняем…">{label}</SubmitButton>
              ))}
            </div>
          </ActionForm>
        ) : (
          <p className="mt-3 text-[14px]">{m.status === "DRAFT" ? "Черновик ещё не отправлен автором на модерацию." : "Отклонено. Автор может исправить материал и отправить его снова."}</p>
        )}
      </section>

      <section className="card p-5" aria-labelledby="ver-h">
        <h2 id="ver-h" className="font-semibold">Статус проверки</h2>
        <p className="mt-1 text-[14px] text-muted">Система проверяет требования к выбранному статусу на сервере. Ниже — текущее выполнение требований.</p>
        <ul className="mt-3 flex flex-col gap-2 text-[14px]">
          {verificationOrder.map((s) => {
            const problems = checkVerificationRequirements(s, ctx(m.researchId));
            return (
              <li key={s} className="flex flex-wrap items-start gap-2">
                <span className={problems.length ? "text-muted" : "text-ok"}>{problems.length ? "✗" : "✓"}</span>
                <span className="font-medium">{verificationLabels[s]}</span>
                {problems.length > 0 && <span className="basis-full pl-5 text-[13px] text-muted sm:basis-auto sm:pl-0">— {problems.join(" ")}</span>}
              </li>
            );
          })}
        </ul>
        <ActionForm action={setVerificationAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={m.id} />
          <div>
            <label htmlFor="ver-status" className="label">Новый статус</label>
            <select id="ver-status" name="status" defaultValue={m.verificationStatus} className="input">
              {verificationOrder.map((s) => <option key={s} value={s}>{verificationLabels[s]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="ver-research" className="label">Связанное исследование</label>
            <select id="ver-research" name="researchId" defaultValue={m.researchId ?? ""} className="input">
              <option value="">Нет</option>
              {research.map((r) => <option key={r.id} value={r.id}>{r.title}{r.isDemo ? " (учебный пример)" : ""}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="ver-comment" className="label">Обоснование</label>
            <textarea id="ver-comment" name="comment" rows={2} className="input" placeholder="На основании чего меняется статус" />
          </div>
          <div className="sm:col-span-2"><SubmitButton className="btn-secondary">Изменить статус проверки</SubmitButton></div>
        </ActionForm>
        <details className="mt-4 text-[13.5px] text-muted">
          <summary className="cursor-pointer">Критерии статусов</summary>
          <ul className="mt-2 space-y-2">
            {verificationOrder.map((s) => <li key={s}><b>{verificationLabels[s]}:</b> {verificationCriteria[s].requirements.join(" ")}</li>)}
          </ul>
        </details>
      </section>

      <section className="card p-5" aria-labelledby="sum-h">
        <h2 id="sum-h" className="font-semibold">Кратко о содержании</h2>
        <dl className="mt-3 grid gap-2 text-[14px] sm:grid-cols-2">
          <div><dt className="text-muted">Классы</dt><dd>{formatGrades(m.gradeFrom, m.gradeTo)}</dd></div>
          <div><dt className="text-muted">Подготовка</dt><dd>{formatMinutes(m.prepTimeMin)}</dd></div>
          <div><dt className="text-muted">Категории</dt><dd>{m.categories.map((c) => c.category.name).join(", ") || "—"}</dd></div>
          <div><dt className="text-muted">Лицензия</dt><dd>{m.license || "—"}</dd></div>
          <div><dt className="text-muted">Шагов инструкции</dt><dd>{m.steps.length}</dd></div>
          <div><dt className="text-muted">Вложений</dt><dd>{m.attachments.length}</dd></div>
        </dl>
      </section>

      <section className="card p-5" aria-labelledby="hist-h">
        <h2 id="hist-h" className="font-semibold">История</h2>
        <ol className="mt-3 flex flex-col gap-2 text-[14px]">
          {m.moderationEvents.map((e) => (
            <li key={e.id}>
              <span className="text-muted">{formatDate(e.createdAt)} · {e.actor.name}: </span>
              {e.toStatus && <>{e.fromStatus ? `${publicationStatusLabels[e.fromStatus]} → ` : ""}{publicationStatusLabels[e.toStatus]}</>}
              {e.toVerification && <>проверка: {e.fromVerification ? `${verificationLabels[e.fromVerification]} → ` : ""}{verificationLabels[e.toVerification]}</>}
              {e.comment && <span className="text-ink-soft"> — {e.comment}</span>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
