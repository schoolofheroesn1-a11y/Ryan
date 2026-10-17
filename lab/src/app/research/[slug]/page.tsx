import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResearchTable } from "@/components/research-table";
import { ReportForm } from "@/components/material-interactions";
import { DemoBadge, PublicationBadge, TypeLabel } from "@/components/ui/badges";
import { CopyButton } from "@/components/ui/copy-button";
import { ShareButton } from "@/components/ui/share-button";
import { prisma } from "@/lib/db";
import { formatDate, paragraphs } from "@/lib/format";
import { researchKindHints, researchKindLabels } from "@/lib/labels";
import { getCurrentUser } from "@/server/auth";
import { isStaff } from "@/server/permissions";
import { getResearchForView } from "@/server/research";

export async function generateMetadata({ params }: PageProps<"/research/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const r = await prisma.research.findUnique({ where: { slug }, select: { title: true, summary: true, status: true } });
  if (!r || r.status !== "PUBLISHED") return { title: "Испытание", robots: { index: false } };
  return { title: r.title, description: r.summary.slice(0, 200), alternates: { canonical: `/research/${slug}` } };
}

function Block({ title, value, id }: { title: string; value: string; id?: string }) {
  const ps = paragraphs(value);
  return (
    <section id={id} className="border-t border-line pt-6">
      <h2 className="mb-3 text-[19px] font-semibold">{title}</h2>
      {ps.length ? <div className="prose-lab whitespace-pre-line">{ps.map((p, i) => <p key={i}>{p}</p>)}</div> : <p className="text-muted">Не указано.</p>}
    </section>
  );
}

export default async function ResearchPage({ params }: PageProps<"/research/[slug]">) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const r = await getResearchForView(slug, user);
  if (!r) notFound();

  return (
    <article>
      <header className="border-b border-line bg-surface">
        <div className="container-page py-8 sm:py-10">
          <nav aria-label="Навигационная цепочка" className="mb-4 text-[13px] text-muted">
            <Link href="/research" className="hover:text-ink">Лаборатория испытаний</Link>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-accent/30 bg-accent-soft px-2.5 py-1 text-[13px] font-medium text-accent">{researchKindLabels[r.kind]}</span>
            {r.isDemo && <DemoBadge label="Учебный пример — испытание не проводилось" />}
            {r.status !== "PUBLISHED" && <PublicationBadge status={r.status} />}
          </div>
          <h1 className="mt-3 max-w-4xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-[38px]">{r.title}</h1>
          <p className="mt-4 max-w-3xl text-[17px] leading-relaxed text-ink-soft">{r.summary}</p>
          <p className="mt-3 max-w-3xl rounded-lg bg-paper px-3 py-2 text-[14px] text-muted">{researchKindHints[r.kind]}</p>
          <dl className="mt-6 grid max-w-3xl gap-4 text-[14px] sm:grid-cols-3">
            <div><dt className="text-muted">Автор</dt><dd><Link href={`/authors/${r.author.id}`} className="link">{r.author.name}</Link></dd></div>
            <div><dt className="text-muted">Проведено</dt><dd>{r.conductedFrom ? `${formatDate(r.conductedFrom)}${r.conductedTo ? ` — ${formatDate(r.conductedTo)}` : ""}` : "даты не указаны"}</dd></div>
            <div><dt className="text-muted">Критерии зафиксированы</dt><dd>{r.criteriaLockedAt ? formatDate(r.criteriaLockedAt) : <span className="text-warn">ещё не зафиксированы</span>}</dd></div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            {r.status === "PUBLISHED" && <ShareButton title={r.title} path={`/research/${r.slug}`} />}
            {r.reproduction && <CopyButton text={r.reproduction} label="Копировать порядок воспроизведения" className="btn-secondary" />}
            {isStaff(user) && <Link href={`/admin/research/${r.id}`} className="btn-ghost">Редактировать</Link>}
          </div>
        </div>
      </header>

      <div className="container-page flex max-w-5xl flex-col gap-6 py-8">
        <section className="grid gap-4 md:grid-cols-2">
          <div className="card p-5">
            <p className="eyebrow">Исследовательский вопрос</p>
            <p className="mt-2 text-[16px] leading-relaxed">{r.question}</p>
          </div>
          <div className="card p-5">
            <p className="eyebrow">Гипотеза</p>
            <p className="mt-2 text-[16px] leading-relaxed">{r.hypothesis || "Не сформулирована."}</p>
          </div>
        </section>

        <section className="border-t border-line pt-6">
          <h2 className="mb-3 text-[19px] font-semibold">Участники испытания</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {r.tools.map((t) => (
              <li key={t.id} className="rounded-xl border border-line p-4 text-[14px]">
                <p className="font-semibold">{t.name}</p>
                <p className="text-muted">Версия: {t.version}{t.vendor && ` · ${t.vendor}`}</p>
                {t.pricing && <p className="mt-1">Стоимость: {t.pricing}</p>}
                {t.availability && <p>Доступность в России: {t.availability}</p>}
              </li>
            ))}
          </ul>
        </section>

        <Block title="Условия и ограничения испытания" value={`${r.conditions}\n\n${r.limitations}`} />
        <Block title="Одинаковые исходные задания" value={r.inputTasks} />

        <section className="border-t border-line pt-6" id="results">
          <h2 className="mb-1 text-[19px] font-semibold">Результаты по критериям</h2>
          <p className="mb-4 text-[14px] text-muted">
            Оценки показаны по каждому критерию и сводно по измерениям. Единого балла нет: критическая ошибка не компенсируется высокими оценками удобства.
          </p>
          {r.results.length ? (
            <ResearchTable tools={r.tools} criteria={r.criteria} results={r.results} issues={r.issues} />
          ) : (
            <p className="text-muted">Результаты ещё не внесены.</p>
          )}
          {r.issues.some((i) => !i.isCritical) && (
            <div className="mt-4">
              <h3 className="mb-2 font-semibold">Некритические замечания</h3>
              <ul className="list-disc space-y-1 pl-5 text-[14.5px] text-ink-soft">
                {r.issues.filter((i) => !i.isCritical).map((i) => (
                  <li key={i.id}><b>{r.tools.find((t) => t.id === i.toolId)?.name}:</b> {i.description}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <Block title="Исходные результаты" value={r.rawResults} />
        <Block title="Обнаруженные ошибки" value={r.errorsFound} />
        <Block title="Затраты времени и ресурсов" value={r.resourceCosts} />
        <Block title="Необходимость ручной доработки" value={r.manualRework} />
        <Block title="Педагогическая проверка" value={r.pedagogicalCheck} />
        <Block title="Выводы" value={r.conclusions} />
        <Block title="Рекомендации" value={r.recommendations} />
        <Block id="reproduction" title="Как воспроизвести испытание" value={r.reproduction} />

        {r.moderationEvents.length > 0 && (
          <section className="border-t border-line pt-6">
            <h2 className="mb-3 text-[19px] font-semibold">История публикации</h2>
            <ol className="flex flex-col gap-1.5 text-[14.5px] text-ink-soft">
              {r.moderationEvents.map((e) => (
                <li key={e.id}>
                  <span className="text-muted">{formatDate(e.createdAt)}:</span> {e.toStatus === "PUBLISHED" ? "опубликовано" : e.toStatus === "UNPUBLISHED" ? "снято с публикации для исправлений" : "изменён статус"}
                  {e.comment && <> — {e.comment}</>}
                </li>
              ))}
            </ol>
          </section>
        )}

        {r.status === "PUBLISHED" && (
          <section className="card-raised p-5 sm:p-7" aria-labelledby="report-h">
            <h2 id="report-h" className="font-semibold">Нашли ошибку в испытании?</h2>
            <p className="mb-3 mt-1 text-[13.5px] text-muted">Сообщение увидит только редакция. По подтверждённому сообщению испытание снимается с публикации для исправления.</p>
            {user ? <ReportForm researchSlug={r.slug} /> : <p className="text-[14px] text-muted"><Link href={`/login?next=/research/${r.slug}`} className="link">Войдите</Link>, чтобы отправить сообщение.</p>}
          </section>
        )}

        {r.materials.length > 0 && (
          <section className="border-t border-line pt-6">
            <h2 className="mb-3 text-[19px] font-semibold">Связанные материалы библиотеки</h2>
            <ul className="flex flex-col gap-2">
              {r.materials.map((m) => (
                <li key={m.slug}><TypeLabel type={m.type} /> <Link href={`/m/${m.slug}`} className="link">{m.title}</Link></li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </article>
  );
}
