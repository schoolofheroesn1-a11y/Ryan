import type { Metadata } from "next";
import Link from "next/link";
import { DemoBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/format";
import { researchKindHints, researchKindLabels } from "@/lib/labels";
import { listPublishedResearch } from "@/server/research";
import type { ResearchKind } from "@prisma/client";

export const metadata: Metadata = {
  title: "Лаборатория испытаний",
  description: "Практические испытания образовательных технологий и методик: исследовательский вопрос, условия, критерии с весами, результаты по каждому критерию и критические ошибки.",
  alternates: { canonical: "/research" },
};

const kinds: ResearchKind[] = ["TECHNICAL", "TEACHER_REVIEW", "STUDENT_OUTCOMES"];

export default async function ResearchListPage({ searchParams }: PageProps<"/research">) {
  const sp = await searchParams;
  const kind = kinds.find((k) => k === sp.kind);
  const list = await listPublishedResearch(kind);
  return (
    <>
      <PageHeader eyebrow="Лаборатория испытаний" title="Испытания технологий и методик">
        Каждое испытание начинается с вопроса и заранее зафиксированных критериев. Мы показываем оценки по каждому критерию отдельно и
        различаем три вида проверки — они дают знания разной силы.
      </PageHeader>
      <div className="container-page py-8">
        <div className="grid gap-3 md:grid-cols-3">
          {kinds.map((k) => (
            <Link key={k} href={kind === k ? "/research" : `/research?kind=${k}`} aria-current={kind === k ? "true" : undefined} className={`card p-4 ${kind === k ? "border-accent ring-1 ring-accent" : "hover:border-line-strong"}`}>
              <span className="font-semibold">{researchKindLabels[k]}</span>
              <span className="mt-1 block text-[13.5px] text-muted">{researchKindHints[k]}</span>
            </Link>
          ))}
        </div>
        <div className="mt-8 flex flex-col gap-4">
          {list.length === 0 ? (
            <EmptyState title="Испытаний этого вида пока нет">Мы публикуем только испытания, проведённые по методике лаборатории.</EmptyState>
          ) : (
            list.map((r) => (
              <article key={r.id} className="card relative p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="eyebrow">{researchKindLabels[r.kind]}</span>
                  {r.isDemo && <DemoBadge label="Учебный пример — данные условные" />}
                </div>
                <h2 className="mt-2 text-xl font-semibold leading-snug">
                  <Link href={`/research/${r.slug}`} className="after:absolute after:inset-0 hover:text-accent">{r.title}</Link>
                </h2>
                <p className="mt-2 max-w-3xl text-[15px] text-ink-soft"><b className="text-ink">Вопрос:</b> {r.question}</p>
                <p className="mt-3 text-[13.5px] text-muted">
                  Участники: {r.tools.map((t) => t.name).join("; ")}
                </p>
                <p className="mt-1 text-[13.5px] text-muted">
                  {r.author.name} · {formatDate(r.publishedAt)} ·{" "}
                  {r._count.issues > 0 ? <span className="text-danger">критических ошибок: {r._count.issues}</span> : "критических ошибок не выявлено"}
                </p>
              </article>
            ))
          )}
        </div>
      </div>
    </>
  );
}
