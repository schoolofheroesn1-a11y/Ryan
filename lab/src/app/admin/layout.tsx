import Link from "next/link";
import { requirePageStaff } from "@/server/auth";
import { isAdmin } from "@/server/permissions";
import { prisma } from "@/lib/db";

export const metadata = { title: "Редакция", robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requirePageStaff();
  const [pending, reviews, reports] = await Promise.all([
    prisma.material.count({ where: { status: "PENDING" } }),
    prisma.review.count({ where: { status: "PENDING" } }),
    prisma.report.count({ where: { status: "OPEN" } }),
  ]);
  const links: [string, string, number?][] = [
    ["/admin", "Очередь модерации", pending],
    ["/admin/materials", "Материалы"],
    ["/admin/research", "Исследования"],
    ["/admin/reviews", "Отзывы", reviews],
    ["/admin/reports", "Жалобы", reports],
    ["/admin/taxonomy", "Теги и категории"],
    ...(isAdmin(user) ? ([["/admin/users", "Пользователи и роли"], ["/admin/log", "Журнал действий"]] as [string, string][]) : []),
  ];
  return (
    <div className="container-page grid gap-8 py-8 lg:grid-cols-[220px_1fr]">
      <aside>
        <p className="eyebrow mb-3">Редакция</p>
        <nav aria-label="Разделы редакции" className="flex gap-1 overflow-x-auto lg:flex-col">
          {links.map(([href, label, count]) => (
            <Link key={href} href={href} className="flex items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 py-2 text-[14.5px] text-ink-soft hover:bg-neutral-soft hover:text-ink">
              {label}
              {count ? <span className="rounded-full bg-warn-soft px-2 text-[12px] font-semibold text-warn">{count}</span> : null}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
