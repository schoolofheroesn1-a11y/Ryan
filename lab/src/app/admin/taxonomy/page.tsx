import { createCategoryAction, deleteCategoryAction, deleteTagAction, renameCategoryAction, renameTagAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { prisma } from "@/lib/db";
import { categoryKindLabels } from "@/lib/labels";
import { requirePageStaff } from "@/server/auth";

export default async function TaxonomyPage() {
  await requirePageStaff();
  const [categories, tags] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ kind: "asc" }, { order: "asc" }], include: { _count: { select: { materials: true } } } }),
    prisma.tag.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { materials: true } } } }),
  ]);
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-serif text-2xl font-semibold">Теги и категории</h1>
      {(Object.keys(categoryKindLabels) as (keyof typeof categoryKindLabels)[]).map((kind) => (
        <section key={kind} className="card p-5">
          <h2 className="font-semibold">{categoryKindLabels[kind]}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {categories.filter((c) => c.kind === kind).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <ActionForm action={renameCategoryAction} className="flex flex-1 flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <label className="sr-only" htmlFor={`c-${c.id}`}>Название</label>
                  <input id={`c-${c.id}`} name="name" defaultValue={c.name} className="input max-w-sm py-1.5" />
                  <span className="text-[13px] text-muted">материалов: {c._count.materials}</span>
                  <SubmitButton className="btn-ghost btn-sm">Сохранить</SubmitButton>
                </ActionForm>
                {c._count.materials === 0 && (
                  <ActionForm action={deleteCategoryAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <SubmitButton className="btn-danger btn-sm">Удалить</SubmitButton>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
          <ActionForm action={createCategoryAction} className="mt-4 flex flex-wrap gap-2">
            <input type="hidden" name="kind" value={kind} />
            <label className="sr-only" htmlFor={`new-${kind}`}>Новая категория</label>
            <input id={`new-${kind}`} name="name" className="input max-w-sm" placeholder="Новая категория" />
            <SubmitButton className="btn-secondary btn-sm">Добавить</SubmitButton>
          </ActionForm>
        </section>
      ))}
      <section className="card p-5">
        <h2 className="font-semibold">Теги</h2>
        <p className="mt-1 text-[13.5px] text-muted">Теги создаются авторами при публикации. Здесь можно исправить написание или удалить лишние.</p>
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {tags.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <ActionForm action={renameTagAction} className="flex flex-1 items-center gap-2">
                <input type="hidden" name="id" value={t.id} />
                <label className="sr-only" htmlFor={`t-${t.id}`}>Тег</label>
                <input id={`t-${t.id}`} name="name" defaultValue={t.name} className="input py-1.5" />
                <span className="text-[12px] text-muted">{t._count.materials}</span>
                <SubmitButton className="btn-ghost btn-sm">✓</SubmitButton>
              </ActionForm>
              <ActionForm action={deleteTagAction}>
                <input type="hidden" name="id" value={t.id} />
                <SubmitButton className="btn-danger btn-sm" aria-label={`Удалить тег ${t.name}`}>✕</SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
