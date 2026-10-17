import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MaterialCard } from "@/components/material-card";
import { DemoBadge } from "@/components/ui/badges";
import { prisma } from "@/lib/db";
import { formatDate, paragraphs } from "@/lib/format";
import { researchKindLabels } from "@/lib/labels";
import { cardInclude } from "@/server/materials";

async function load(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, specialization: true, bio: true, links: true, isDemo: true, createdAt: true,
      materials: { where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, include: { ...cardInclude, categories: { include: { category: true } } } },
      research: { where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, select: { slug: true, title: true, kind: true, isDemo: true, publishedAt: true } },
      reviews: { where: { status: "APPROVED", material: { status: "PUBLISHED" } }, orderBy: { createdAt: "desc" }, select: { id: true, appliedInPractice: true, createdAt: true, material: { select: { slug: true, title: true } } } },
    },
  });
}

export async function generateMetadata({ params }: PageProps<"/authors/[id]">): Promise<Metadata> {
  const { id } = await params;
  const u = await prisma.user.findUnique({ where: { id }, select: { name: true, specialization: true, isBlocked: true } });
  if (!u || u.isBlocked) return { title: "Автор" };
  return { title: u.name, description: u.specialization ?? `Профиль автора ${u.name}` };
}

export default async function AuthorPage({ params }: PageProps<"/authors/[id]">) {
  const { id } = await params;
  const u = await load(id);
  if (!u) notFound();
  const practice = u.reviews.filter((r) => r.appliedInPractice);
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="container-page py-10">
          <p className="eyebrow">Профиль автора</p>
          <h1 className="mt-2 flex flex-wrap items-center gap-3 font-serif text-3xl font-semibold">
            {u.name} {u.isDemo && <DemoBadge label="Демонстрационный профиль" />}
          </h1>
          {u.specialization && <p className="mt-2 max-w-2xl text-[16px] text-ink-soft">{u.specialization}</p>}
          {u.bio && <div className="prose-lab mt-3 max-w-2xl">{paragraphs(u.bio).map((p, i) => <p key={i}>{p}</p>)}</div>}
          {u.links.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-3 text-[14px]">
              {u.links.map((l) => (
                <li key={l}><a href={l} className="link break-all" target="_blank" rel="noopener noreferrer nofollow ugc">{l.replace(/^https?:\/\//, "")}</a></li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[13px] text-muted">
            На платформе с {formatDate(u.createdAt)} · материалов: {u.materials.length} · испытаний: {u.research.length} · опубликованных отзывов: {u.reviews.length}
          </p>
        </div>
      </header>
      <div className="container-page flex flex-col gap-10 py-8">
        <section aria-labelledby="mat">
          <h2 id="mat" className="text-xl font-semibold">Опубликованные материалы</h2>
          {u.materials.length ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{u.materials.map((m) => <MaterialCard key={m.id} m={m} />)}</div>
          ) : (
            <p className="mt-3 text-muted">Пока нет опубликованных материалов.</p>
          )}
        </section>
        {u.research.length > 0 && (
          <section aria-labelledby="res">
            <h2 id="res" className="text-xl font-semibold">Испытания</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {u.research.map((r) => (
                <li key={r.slug}>
                  <Link href={`/research/${r.slug}`} className="link">{r.title}</Link>{" "}
                  <span className="text-[13px] text-muted">{researchKindLabels[r.kind]}{r.isDemo ? " · учебный пример" : ""}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section aria-labelledby="rev">
          <h2 id="rev" className="text-xl font-semibold">Отзывы о применении чужих материалов</h2>
          {u.reviews.length ? (
            <ul className="mt-3 flex flex-col gap-2 text-[14.5px]">
              {u.reviews.map((r) => (
                <li key={r.id}>
                  <Link href={`/m/${r.material.slug}#reviews`} className="link">{r.material.title}</Link>
                  <span className="text-muted"> · {formatDate(r.createdAt)}{r.appliedInPractice ? " · применял(а) на практике" : ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-muted">Опубликованных отзывов нет.</p>
          )}
          {practice.length > 0 && <p className="mt-2 text-[13px] text-muted">Подтверждённых применений на практике: {practice.length}.</p>}
        </section>
      </div>
    </>
  );
}
