import type { Metadata } from "next";
import Link from "next/link";
import { ProfileForm } from "@/components/forms/profile-form";
import { MaterialCard } from "@/components/material-card";
import { DeleteDraftButton } from "@/components/delete-draft-button";
import { PublicationBadge, VerificationBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/empty-state";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { publicationStatusLabels, reviewStatusLabels, verificationLabels } from "@/lib/labels";
import { requirePageUser } from "@/server/auth";
import { cardInclude } from "@/server/materials";
import type { PublicationStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Личный кабинет", robots: { index: false } };

const tabs = [
  ["favorites", "Избранное"],
  ["publications", "Мои публикации"],
  ["reviews", "Мои отзывы"],
  ["settings", "Настройки профиля"],
] as const;

const groups: { title: string; statuses: PublicationStatus[] }[] = [
  { title: "Черновики", statuses: ["DRAFT"] },
  { title: "На модерации", statuses: ["PENDING"] },
  { title: "Требуют доработки", statuses: ["REJECTED", "UNPUBLISHED"] },
  { title: "Опубликованные", statuses: ["PUBLISHED"] },
];

export default async function MePage({ searchParams }: PageProps<"/me">) {
  const user = await requirePageUser("/me");
  const sp = await searchParams;
  const tab = tabs.find(([k]) => k === sp.tab)?.[0] ?? "favorites";

  return (
    <>
      <PageHeader eyebrow="Личный кабинет" title={user.name} actions={<><Link href={`/authors/${user.id}`} className="btn-secondary">Публичный профиль</Link><Link href="/submit" className="btn-primary">Предложить материал</Link></>} />
      <div className="container-page py-6">
        <nav aria-label="Разделы кабинета" className="-mx-1 flex gap-1 overflow-x-auto border-b border-line pb-px">
          {tabs.map(([k, label]) => (
            <Link key={k} href={`/me?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-[15px] ${tab === k ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-6">
          {sp.submitted && <div className="mb-6"><FormMessage ok message="Материал отправлен на модерацию. Статус и комментарии редакции появятся здесь." /></div>}
          {tab === "favorites" && <Favorites userId={user.id} />}
          {tab === "publications" && <Publications userId={user.id} />}
          {tab === "reviews" && <Reviews userId={user.id} />}
          {tab === "settings" && <Settings userId={user.id} />}
        </div>
      </div>
    </>
  );
}

async function Favorites({ userId }: { userId: string }) {
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId, material: { status: "PUBLISHED" } },
    orderBy: { createdAt: "desc" },
    include: { material: { include: { ...cardInclude, categories: { include: { category: true } } } } },
  });
  if (!bookmarks.length)
    return <EmptyState title="В избранном пока ничего нет" action={<Link href="/library" className="btn-secondary">Открыть библиотеку</Link>}>Нажмите «В избранное» на странице материала, чтобы сохранить его здесь.</EmptyState>;
  return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{bookmarks.map((b) => <MaterialCard key={b.materialId} m={b.material} />)}</div>;
}

async function Publications({ userId }: { userId: string }) {
  const materials = await prisma.material.findMany({
    where: { authorId: userId },
    orderBy: { updatedAt: "desc" },
    include: { moderationEvents: { orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } } },
  });
  if (!materials.length)
    return <EmptyState title="У вас пока нет публикаций" action={<Link href="/submit" className="btn-primary">Предложить материал</Link>}>Опишите свой приём или кейс — после проверки редакцией он появится в библиотеке.</EmptyState>;
  return (
    <div className="flex flex-col gap-8">
      {groups.map((g) => {
        const list = materials.filter((m) => g.statuses.includes(m.status));
        if (!list.length) return null;
        return (
          <section key={g.title} aria-label={g.title}>
            <h2 className="mb-3 text-lg font-semibold">{g.title} <span className="font-normal text-muted">({list.length})</span></h2>
            <ul className="flex flex-col gap-3">
              {list.map((m) => {
                const lastComment = m.moderationEvents.find((e) => e.comment && e.actorId !== userId);
                return (
                  <li key={m.id} className="card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2"><PublicationBadge status={m.status} /><VerificationBadge status={m.verificationStatus} size="sm" /></div>
                        <h3 className="mt-2 font-semibold">{m.title}</h3>
                        <p className="text-[13px] text-muted">Обновлено {formatDate(m.updatedAt)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/m/${m.slug}`} className="btn-ghost btn-sm">Открыть</Link>
                        {m.status !== "PENDING" && <Link href={`/me/materials/${m.id}/edit`} className="btn-secondary btn-sm">Редактировать</Link>}
                        {(m.status === "DRAFT" || m.status === "REJECTED") && <DeleteDraftButton materialId={m.id} />}
                      </div>
                    </div>
                    {(m.status === "REJECTED" || m.status === "UNPUBLISHED") && lastComment && (
                      <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-[14px] text-danger">Комментарий редакции: {lastComment.comment}</p>
                    )}
                    {m.moderationEvents.length > 0 && (
                      <details className="mt-3 text-[14px]">
                        <summary className="cursor-pointer text-muted">История статусов ({m.moderationEvents.length})</summary>
                        <ol className="mt-2 flex flex-col gap-1.5 border-l border-line pl-4">
                          {m.moderationEvents.map((e) => (
                            <li key={e.id}>
                              <span className="text-muted">{formatDate(e.createdAt)} · {e.actor.name}: </span>
                              {e.toStatus && <>{e.fromStatus ? `${publicationStatusLabels[e.fromStatus]} → ` : ""}{publicationStatusLabels[e.toStatus]}</>}
                              {e.toVerification && <>Статус проверки: {verificationLabels[e.toVerification]}</>}
                              {e.comment && <span className="text-ink-soft"> — {e.comment}</span>}
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

async function Reviews({ userId }: { userId: string }) {
  const reviews = await prisma.review.findMany({ where: { authorId: userId }, orderBy: { createdAt: "desc" }, include: { material: { select: { slug: true, title: true } } } });
  if (!reviews.length) return <EmptyState title="Вы ещё не оставляли отзывов">Отзывы о применении материалов помогают коллегам и повышают статус проверки решений.</EmptyState>;
  return (
    <ul className="flex flex-col gap-3">
      {reviews.map((r) => (
        <li key={r.id} className="card p-4 text-[14.5px]">
          <Link href={`/m/${r.material.slug}`} className="link font-medium">{r.material.title}</Link>
          <span className="ml-2 text-[13px] text-muted">{reviewStatusLabels[r.status]} · {formatDate(r.createdAt)}</span>
          <p className="mt-1 text-ink-soft">{r.body}</p>
        </li>
      ))}
    </ul>
  );
}

async function Settings({ userId }: { userId: string }) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return (
    <>
      <p className="mb-4 text-[14px] text-muted">Почта для входа: {u.email}</p>
      <ProfileForm initial={{ name: u.name, specialization: u.specialization ?? "", bio: u.bio ?? "", links: u.links.join("\n") }} />
    </>
  );
}
