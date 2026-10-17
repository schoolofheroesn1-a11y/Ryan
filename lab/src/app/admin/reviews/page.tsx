import Link from "next/link";
import { moderateReviewAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ui/action-form";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requirePageStaff } from "@/server/auth";

export default async function AdminReviewsPage() {
  await requirePageStaff();
  const reviews = await prisma.review.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { name: true, id: true } }, material: { select: { title: true, slug: true } } },
  });
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Отзывы на проверке</h1>
      <p className="mt-1 text-[14px] text-muted">Публикуйте отзывы, которые описывают реальный опыт. Отзывы с отметкой «применял на практике» влияют на статус проверки материала.</p>
      <div className="mt-6 flex flex-col gap-3">
        {reviews.length === 0 ? <EmptyState title="Новых отзывов нет" /> : reviews.map((r) => (
          <article key={r.id} className="card p-5">
            <p className="text-[14px]"><Link href={`/m/${r.material.slug}`} className="link font-medium">{r.material.title}</Link></p>
            <p className="mt-1 text-[13px] text-muted">{r.author.name} · {formatDate(r.createdAt)}{r.appliedInPractice ? " · применял(а) на практике" : ""}</p>
            {r.context && <p className="mt-1 text-[13.5px] text-ink-soft">Контекст: {r.context}</p>}
            <p className="mt-2 whitespace-pre-line text-[15px]">{r.body}</p>
            <ActionForm action={moderateReviewAction} className="mt-3 flex gap-2">
              <input type="hidden" name="id" value={r.id} />
              <SubmitButton name="approve" value="1" className="btn-primary btn-sm">Опубликовать</SubmitButton>
              <SubmitButton name="approve" value="0" className="btn-danger btn-sm">Отклонить</SubmitButton>
            </ActionForm>
          </article>
        ))}
      </div>
    </div>
  );
}
