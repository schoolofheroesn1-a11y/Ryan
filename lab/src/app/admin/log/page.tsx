import { prisma } from "@/lib/db";
import { requirePageAdmin } from "@/server/auth";

const fmt = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Moscow" });

export default async function LogPage() {
  await requirePageAdmin();
  const entries = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { actor: { select: { name: true } } } });
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Журнал административных действий</h1>
      <p className="mt-1 text-[14px] text-muted">Последние 200 записей.</p>
      <div className="mt-5 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[640px] text-[14px]">
          <thead className="bg-paper text-left text-muted"><tr><th className="p-3 font-medium">Время</th><th className="p-3 font-medium">Кто</th><th className="p-3 font-medium">Действие</th><th className="p-3 font-medium">Объект</th><th className="p-3 font-medium">Подробности</th></tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-line align-top">
                <td className="whitespace-nowrap p-3 text-muted">{fmt.format(e.createdAt)}</td>
                <td className="p-3">{e.actor.name}</td>
                <td className="p-3 font-mono text-[13px]">{e.action}</td>
                <td className="p-3 text-[13px] text-muted">{e.targetType} {e.targetId.slice(0, 8)}</td>
                <td className="p-3 text-[13px]">{e.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && <p className="p-6 text-muted">Записей пока нет.</p>}
      </div>
    </div>
  );
}
