import type { Metadata } from "next";
import Link from "next/link";
import { MaterialForm } from "@/components/forms/material-form";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/server/auth";
import { taxonomyOptions } from "@/server/material-form";
import { isStaff } from "@/server/permissions";

export const metadata: Metadata = { title: "Предложить материал", robots: { index: false } };

export default async function SubmitPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <>
        <PageHeader eyebrow="Публикация" title="Предложить материал">
          Поделитесь приёмом, кейсом, шаблоном или обзором инструмента. Материал появится в библиотеке после проверки редакцией.
        </PageHeader>
        <div className="container-page max-w-3xl py-10">
          <div className="card p-6 sm:p-8">
            <h2 className="text-lg font-semibold">Чтобы предложить материал, войдите или зарегистрируйтесь</h2>
            <p className="mt-2 text-ink-soft">Так вы сможете сохранять черновики, следить за статусом модерации и отвечать на замечания редакции.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/login?next=/submit" className="btn-primary">Войти</Link>
              <Link href="/register?next=/submit" className="btn-secondary">Зарегистрироваться</Link>
            </div>
          </div>
          <MaterialStructureHint />
        </div>
      </>
    );
  }
  const options = await taxonomyOptions();
  return (
    <>
      <PageHeader eyebrow="Публикация" title="Предложить материал">
        Заполните разделы по единой структуре — так учителю будет проще понять, подходит ли ему решение. Сохраняйте черновик в любой момент.
      </PageHeader>
      <div className="container-page grid max-w-6xl gap-8 py-8 lg:grid-cols-[1fr_280px]">
        <MaterialForm initial={{}} {...options} isStaff={isStaff(user)} hasAttachmentSlot republishWarning={false} />
        <aside className="hidden lg:block"><MaterialStructureHint /></aside>
      </div>
    </>
  );
}

function MaterialStructureHint() {
  return (
    <div className="card mt-6 p-5 text-[14px] text-ink-soft lg:sticky lg:top-24 lg:mt-0">
      <p className="font-semibold text-ink">Как проходит модерация</p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5">
        <li>Вы отправляете материал — он получает статус «На модерации».</li>
        <li>Редакция проверяет полноту, корректность и условия использования.</li>
        <li>Материал публикуется или возвращается с комментарием.</li>
        <li>Новые материалы получают статус проверки «Не тестировалось»; выше — по <Link href="/methodology#statuses" className="link">критериям лаборатории</Link>.</li>
      </ol>
    </div>
  );
}
