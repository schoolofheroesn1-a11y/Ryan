import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AttachmentList } from "@/components/attachment-list";
import { MaterialForm } from "@/components/forms/material-form";
import { PublicationBadge } from "@/components/ui/badges";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/server/auth";
import { MAX_ATTACHMENTS } from "@/server/attachments";
import { materialToFormValues, taxonomyOptions } from "@/server/material-form";
import { canEditMaterial, isStaff } from "@/server/permissions";

export const metadata: Metadata = { title: "Редактирование материала", robots: { index: false } };

export default async function EditMaterialPage({ params, searchParams }: PageProps<"/me/materials/[id]/edit">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requirePageUser(`/me/materials/${id}/edit`);
  const m = await prisma.material.findUnique({
    where: { id },
    include: { categories: { include: { category: true } }, tags: { include: { tag: true } }, attachments: true },
  });
  // Чужой материал отображается как несуществующий — не раскрываем сам факт его наличия.
  if (!m || (m.authorId !== user.id && !isStaff(user))) notFound();
  const editable = canEditMaterial(user, m);
  const options = await taxonomyOptions();
  const saved = typeof sp.saved === "string" ? sp.saved : null;
  const fileError = typeof sp.fileError === "string" ? sp.fileError : null;

  return (
    <>
      <PageHeader eyebrow="Редактирование" title={m.title} actions={<Link href={`/m/${m.slug}`} className="btn-secondary">Просмотр страницы</Link>}>
        <span className="flex items-center gap-2 text-[14px]">Статус: <PublicationBadge status={m.status} /></span>
      </PageHeader>
      <div className="container-page flex max-w-4xl flex-col gap-6 py-8">
        {saved === "draft" && <FormMessage ok message="Черновик сохранён. Его видите только вы и редакция." />}
        {saved && saved !== "draft" && <FormMessage ok message="Изменения сохранены." />}
        {fileError && <FormMessage message={`Материал сохранён, но файл не прикреплён: ${fileError}`} />}
        {!editable ? (
          <FormMessage message="Материал находится на модерации. Редактирование будет доступно после решения редакции." />
        ) : (
          <>
            {m.attachments.length > 0 && <AttachmentList materialId={m.id} attachments={m.attachments} />}
            <MaterialForm
              id={m.id}
              initial={materialToFormValues(m)}
              {...options}
              isStaff={isStaff(user)}
              hasAttachmentSlot={m.attachments.length < MAX_ATTACHMENTS}
              republishWarning={!isStaff(user) && m.status === "PUBLISHED"}
            />
          </>
        )}
      </div>
    </>
  );
}
