import { setBlockedAction, setRoleAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ui/action-form";
import { DemoBadge } from "@/components/ui/badges";
import { SubmitButton } from "@/components/ui/submit-button";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { roleLabels } from "@/lib/labels";
import { requirePageAdmin } from "@/server/auth";

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const me = await requirePageAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { materials: true } } },
  });
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Пользователи и роли</h1>
      <p className="mt-1 text-[14px] text-muted">Редактор модерирует материалы, отзывы и жалобы, ведёт исследования. Администратор дополнительно управляет ролями и видит журнал.</p>
      <form className="mt-4 flex gap-2" method="get">
        <label htmlFor="u-q" className="sr-only">Поиск</label>
        <input id="u-q" name="q" defaultValue={q} className="input max-w-sm" placeholder="Имя или почта" />
        <button className="btn-secondary" type="submit">Найти</button>
      </form>
      <ul className="mt-5 flex flex-col gap-3">
        {users.map((u) => (
          <li key={u.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">{u.name} {u.isDemo && <DemoBadge />} {u.isBlocked && <span className="text-[13px] text-danger">заблокирован</span>}</p>
              <p className="text-[13px] text-muted">{u.email} · с {formatDate(u.createdAt)} · материалов: {u._count.materials}</p>
            </div>
            {u.id === me.id ? (
              <span className="text-[13px] text-muted">{roleLabels[u.role]} (это вы)</span>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <ActionForm action={setRoleAction} className="flex items-center gap-2">
                  <input type="hidden" name="userId" value={u.id} />
                  <label htmlFor={`role-${u.id}`} className="sr-only">Роль</label>
                  <select id={`role-${u.id}`} name="role" defaultValue={u.role} className="input py-1.5">
                    {Object.entries(roleLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <SubmitButton className="btn-secondary btn-sm">Сохранить</SubmitButton>
                </ActionForm>
                <ActionForm action={setBlockedAction}>
                  <input type="hidden" name="userId" value={u.id} />
                  <input type="hidden" name="blocked" value={u.isBlocked ? "0" : "1"} />
                  <SubmitButton className={u.isBlocked ? "btn-secondary btn-sm" : "btn-danger btn-sm"}>{u.isBlocked ? "Разблокировать" : "Заблокировать"}</SubmitButton>
                </ActionForm>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
