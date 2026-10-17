import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MaterialCard } from "@/components/material-card";
import { BookmarkButton, ReportForm, ReviewForm } from "@/components/material-interactions";
import { DemoBadge, PublicationBadge, TypeLabel, VerificationBadge } from "@/components/ui/badges";
import { CopyButton } from "@/components/ui/copy-button";
import { ShareButton } from "@/components/ui/share-button";
import { prisma } from "@/lib/db";
import { formatDate, formatFileSize, formatGrades, formatMinutes, paragraphs } from "@/lib/format";
import { costLabels, formatLabels, researchKindLabels, skillLabels } from "@/lib/labels";
import { verificationCriteria } from "@/lib/verification";
import { getCurrentUser } from "@/server/auth";
import { getMaterialForView, getSimilarMaterials } from "@/server/materials";
import { canEditMaterial, isStaff } from "@/server/permissions";
import { hasFile } from "@/server/storage";

export async function generateMetadata({ params }: PageProps<"/m/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const m = await prisma.material.findUnique({ where: { slug }, select: { title: true, summary: true, status: true } });
  if (!m || m.status !== "PUBLISHED") return { title: "Материал", robots: { index: false } };
  return {
    title: m.title,
    description: m.summary.slice(0, 200),
    alternates: { canonical: `/m/${slug}` },
    openGraph: { title: m.title, description: m.summary.slice(0, 200), type: "article" },
  };
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t border-line pt-7">
      <h2 id={`${id}-h`} className="mb-3 text-[19px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Text({ value, empty = "Не указано." }: { value: string; empty?: string }) {
  const ps = paragraphs(value);
  if (!ps.length) return <p className="text-muted">{empty}</p>;
  return (
    <div className="prose-lab whitespace-pre-line">
      {ps.map((p, i) => <p key={i}>{p}</p>)}
    </div>
  );
}

export default async function MaterialPage({ params }: PageProps<"/m/[slug]">) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const m = await getMaterialForView(slug, user);
  if (!m) notFound();

  const [similar, bookmark, ownReview, files] = await Promise.all([
    getSimilarMaterials(m),
    user ? prisma.bookmark.findUnique({ where: { userId_materialId: { userId: user.id, materialId: m.id } } }) : null,
    user ? prisma.review.findUnique({ where: { materialId_authorId: { materialId: m.id, authorId: user.id } } }) : null,
    Promise.all(m.attachments.map(async (a) => ({ ...a, available: await hasFile(a.storageKey) }))),
  ]);

  const byKind = (kind: string) => m.categories.filter((c) => c.category.kind === kind).map((c) => c.category);
  const subjects = byKind("SUBJECT");
  const tasks = byKind("TASK");
  const techs = byKind("TECHNOLOGY");
  const instructions = m.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const canEdit = canEditMaterial(user, m);
  const staff = isStaff(user);
  const published = m.status === "PUBLISHED";

  const jsonLd = published
    ? {
        "@context": "https://schema.org",
        "@type": "LearningResource",
        name: m.title,
        description: m.summary,
        inLanguage: "ru",
        dateModified: m.updatedAt.toISOString(),
        datePublished: m.publishedAt?.toISOString(),
        author: { "@type": "Person", name: m.author.name },
        license: m.license,
        educationalUse: tasks.map((t) => t.name).join(", "),
        isAccessibleForFree: m.cost === "FREE",
      }
    : null;

  return (
    <article>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      )}
      {!published && (
        <div className="border-b border-warn/20 bg-warn-soft">
          <div className="container-page flex flex-wrap items-center gap-3 py-3 text-[14px] text-warn">
            <PublicationBadge status={m.status} />
            Этот материал не опубликован и виден только автору и редакции.
            {staff && <Link href={`/admin/materials/${m.id}`} className="link">Открыть в редакции</Link>}
          </div>
        </div>
      )}
      <header className="border-b border-line bg-surface">
        <div className="container-page py-8 sm:py-10">
          <nav aria-label="Навигационная цепочка" className="mb-4 text-[13px] text-muted">
            <Link href="/library" className="hover:text-ink">Библиотека</Link> <span aria-hidden>/</span>{" "}
            <Link href={`/library?type=${m.type}`} className="hover:text-ink"><TypeLabel type={m.type} /></Link>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <VerificationBadge status={m.verificationStatus} />
            {m.isDemo && <DemoBadge label="Демонстрационный материал" />}
          </div>
          <h1 className="mt-3 max-w-4xl font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-[40px]">{m.title}</h1>
          <p className="mt-4 max-w-3xl text-[17px] leading-relaxed text-ink-soft">{m.summary}</p>
          <dl className="mt-6 grid max-w-4xl grid-cols-2 gap-x-4 gap-y-4 text-[14px] sm:grid-cols-4">
            <div><dt className="text-muted">Подготовка</dt><dd className="font-medium">{formatMinutes(m.prepTimeMin)}</dd></div>
            <div><dt className="text-muted">На занятии</dt><dd className="font-medium">{formatMinutes(m.lessonTimeMin)}</dd></div>
            <div><dt className="text-muted">Стоимость</dt><dd className="font-medium">{costLabels[m.cost]}</dd></div>
            <div><dt className="text-muted">Классы</dt><dd className="font-medium">{formatGrades(m.gradeFrom, m.gradeTo)}</dd></div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            {published &&
              (user ? (
                <BookmarkButton materialId={m.id} saved={!!bookmark} />
              ) : (
                <Link href={`/login?next=/m/${m.slug}`} className="btn-secondary">☆ Войдите, чтобы сохранить</Link>
              ))}
            {published && <ShareButton title={m.title} path={`/m/${m.slug}`} />}
            {m.steps.length > 0 && <CopyButton text={`${m.title}\n\n${instructions}`} label="Копировать инструкцию" className="btn-secondary" />}
            {canEdit && <Link href={`/me/materials/${m.id}/edit`} className="btn-ghost">Редактировать</Link>}
          </div>
        </div>
      </header>

      <div className="container-page grid gap-10 py-8 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-7">
          <Section id="problem" title="Какую задачу решает">
            <Text value={m.problem} />
            {tasks.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {tasks.map((t) => <li key={t.id}><Link href={`/library?task=${t.slug}`} className="chip hover:border-accent hover:text-accent">{t.name}</Link></li>)}
              </ul>
            )}
          </Section>
          <Section id="audience" title="Для кого подходит">
            <Text value={m.audience} />
            <p className="mt-2 text-[14px] text-muted">
              {subjects.map((s) => s.name).join(", ") || "Любой предмет"} · {formatGrades(m.gradeFrom, m.gradeTo)} ·{" "}
              {m.formats.map((f) => formatLabels[f]).join(", ") || "формат не указан"} · {skillLabels[m.digitalSkill].toLowerCase()}
            </p>
          </Section>
          <Section id="resources" title="Что понадобится">
            <Text value={m.resources} />
            {techs.length > 0 && <p className="mt-2 text-[14px] text-muted">Технологии: {techs.map((t) => t.name).join(", ")}</p>}
          </Section>
          <Section id="steps" title="Пошаговая инструкция">
            {m.steps.length ? (
              <>
                <ol className="space-y-3">
                  {m.steps.map((s, i) => (
                    <li key={i} className="flex gap-3">
                      <span aria-hidden className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent">{i + 1}</span>
                      <span className="prose-lab">{s}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-4"><CopyButton text={instructions} label="Копировать шаги" /></div>
              </>
            ) : (
              <p className="text-muted">Инструкция не добавлена.</p>
            )}
          </Section>
          {m.prompts.length > 0 && (
            <Section id="prompts" title="Промпты">
              <div className="flex flex-col gap-3">
                {m.prompts.map((p, i) => (
                  <figure key={i} className="rounded-xl border border-line bg-paper p-4">
                    <figcaption className="mb-2 flex items-center justify-between gap-2 text-[13px] text-muted">
                      Промпт {i + 1}
                      <CopyButton text={p} label="Копировать промпт" />
                    </figcaption>
                    <pre className="whitespace-pre-wrap break-words font-sans text-[14.5px] leading-relaxed text-ink">{p}</pre>
                  </figure>
                ))}
              </div>
            </Section>
          )}
          <Section id="example" title="Пример применения"><Text value={m.example} /></Section>
          <Section id="costs" title="Затраты времени и стоимость">
            <ul className="prose-lab list-disc space-y-1 pl-5">
              <li>Подготовка: {formatMinutes(m.prepTimeMin)}</li>
              <li>Время на занятии: {formatMinutes(m.lessonTimeMin)}</li>
              <li>Стоимость: {costLabels[m.cost]}{m.costNote ? `. ${m.costNote}` : ""}</li>
            </ul>
          </Section>
          <Section id="limitations" title="Ограничения и возможные проблемы"><Text value={m.limitations} /></Section>
          <Section id="result" title="Ожидаемый результат"><Text value={m.expectedResult} /></Section>
          {m.adaptation && <Section id="adaptation" title="Как адаптировать"><Text value={m.adaptation} /></Section>}
          {files.length > 0 && (
            <Section id="files" title="Вложения">
              <ul className="flex flex-col gap-2">
                {files.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3">
                    <span className="text-[14.5px]">{f.fileName} <span className="text-muted">· {formatFileSize(f.size)}</span></span>
                    {f.available ? (
                      <a href={`/api/attachments/${f.id}`} className="btn-secondary btn-sm" download>Скачать</a>
                    ) : (
                      <span className="text-[13px] text-muted">Файл временно недоступен</span>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {m.externalUrl && (
            <Section id="link" title="Внешняя ссылка">
              <a href={m.externalUrl} className="link break-all" target="_blank" rel="noopener noreferrer nofollow ugc">{m.externalUrl}</a>
            </Section>
          )}
          <Section id="sources" title="Источники, авторство и условия использования">
            <Text value={m.sources} empty="Источники не указаны." />
            <p className="mt-3 text-[14px] text-ink-soft">
              Автор: <Link href={`/authors/${m.author.id}`} className="link">{m.author.name}</Link>
              {m.license && <> · Условия использования: {m.license}</>}
            </p>
            <p className="mt-1 text-[13px] text-muted">
              Опубликовано {formatDate(m.publishedAt)} · обновлено {formatDate(m.updatedAt)}
            </p>
          </Section>
          <Section id="verification" title="Статус проверки">
            <div className="flex flex-col gap-3">
              <VerificationBadge status={m.verificationStatus} />
              <p className="prose-lab">{verificationCriteria[m.verificationStatus].summary}</p>
              {m.testReport && (
                <div className="rounded-xl border border-line bg-paper p-4">
                  <p className="mb-1 text-[13px] font-medium text-muted">Как автор проверял решение</p>
                  <Text value={m.testReport} />
                </div>
              )}
              {m.research && m.research.status === "PUBLISHED" && (
                <p className="text-[14.5px]">
                  Связанное испытание: <Link href={`/research/${m.research.slug}`} className="link">{m.research.title}</Link>{" "}
                  <span className="text-muted">({researchKindLabels[m.research.kind].toLowerCase()}{m.research.isDemo ? ", учебный пример" : ""})</span>
                </p>
              )}
              <Link href="/methodology#statuses" className="link text-[14px]">Что означают статусы проверки</Link>
            </div>
          </Section>
          <Section id="reviews" title="Отзывы и замечания педагогов">
            {m.reviews.length ? (
              <ul className="flex flex-col gap-4">
                {m.reviews.map((r) => (
                  <li key={r.id} className="rounded-xl border border-line p-4">
                    <p className="text-[14px] font-medium">
                      <Link href={`/authors/${r.author.id}`} className="hover:text-accent">{r.author.name}</Link>
                      <span className="font-normal text-muted"> · {formatDate(r.createdAt)}</span>
                      {r.appliedInPractice && <span className="ml-2 rounded-md bg-ok-soft px-1.5 py-0.5 text-[12px] text-ok">применял(а) на практике</span>}
                    </p>
                    {r.context && <p className="mt-1 text-[13px] text-muted">{r.context}</p>}
                    <p className="prose-lab mt-2 whitespace-pre-line">{r.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Опубликованных отзывов пока нет.</p>
            )}
            {published && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="card p-5">
                  <h3 className="mb-3 font-semibold">Оставить отзыв</h3>
                  {!user ? (
                    <p className="text-[14px] text-muted"><Link href={`/login?next=/m/${m.slug}%23reviews`} className="link">Войдите</Link>, чтобы оставить отзыв.</p>
                  ) : user.id === m.author.id ? (
                    <p className="text-[14px] text-muted">Нельзя оставить отзыв на собственный материал.</p>
                  ) : ownReview ? (
                    <p className="text-[14px] text-muted">Вы уже оставили отзыв{ownReview.status === "PENDING" ? " — он ожидает проверки" : ""}.</p>
                  ) : (
                    <ReviewForm materialId={m.id} />
                  )}
                </div>
                <div className="card p-5">
                  <h3 className="mb-1 font-semibold">Сообщить об ошибке или несоответствии</h3>
                  <p className="mb-3 text-[13px] text-muted">Сообщение увидит только редакция.</p>
                  {user ? <ReportForm materialId={m.id} /> : <p className="text-[14px] text-muted"><Link href={`/login?next=/m/${m.slug}`} className="link">Войдите</Link>, чтобы отправить сообщение.</p>}
                </div>
              </div>
            )}
          </Section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Содержание страницы">
          <nav className="card p-5 text-[14px]">
            <p className="eyebrow mb-3">На странице</p>
            <ol className="flex flex-col gap-1.5 text-ink-soft">
              {[
                ["problem", "Задача"], ["audience", "Для кого"], ["resources", "Что понадобится"], ["steps", "Инструкция"],
                ...(m.prompts.length ? [["prompts", "Промпты"]] : []), ["example", "Пример"], ["costs", "Время и стоимость"],
                ["limitations", "Ограничения"], ["result", "Результат"], ["sources", "Источники"], ["verification", "Статус проверки"], ["reviews", "Отзывы"],
              ].map(([id, label]) => <li key={id}><a href={`#${id}`} className="hover:text-accent">{label}</a></li>)}
            </ol>
          </nav>
          {m.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {m.tags.map((t) => <Link key={t.tagId} href={`/library?q=${encodeURIComponent(t.tag.name)}`} className="chip text-[12.5px] hover:text-accent">#{t.tag.name}</Link>)}
            </div>
          )}
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="container-page" aria-labelledby="similar">
          <h2 id="similar" className="text-xl font-semibold">Похожие материалы</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {similar.map((s) => <MaterialCard key={s.id} m={{ ...s, categories: undefined }} />)}
          </div>
        </section>
      )}
    </article>
  );
}
