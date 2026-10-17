import Link from "next/link";
import { MaterialCard } from "@/components/material-card";
import { SearchBox } from "@/components/search-box";
import { DemoBadge, VerificationBadge } from "@/components/ui/badges";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { researchKindLabels, verificationOrder } from "@/lib/labels";
import { getCurrentUser } from "@/server/auth";
import { cardInclude } from "@/server/materials";
import { listPublishedResearch } from "@/server/research";

const cardQuery = { ...cardInclude, categories: { include: { category: true } } } as const;

const exampleQueries = ["рефлексия", "разноуровневые задания", "проверка понимания", "дискуссия", "игра без программирования", "промпт"];

export default async function HomePage() {
  const [user, verified, research, practice, popular, tasks, typeCounts] = await Promise.all([
    getCurrentUser(),
    prisma.material.findMany({
      where: { status: "PUBLISHED", verificationStatus: { in: ["AUTHOR_TESTED", "MULTI_TEACHER", "INDEPENDENT"] } },
      orderBy: [{ verificationStatus: "desc" }, { publishedAt: "desc" }],
      include: cardQuery,
      take: 3,
    }),
    listPublishedResearch(undefined, 3),
    prisma.material.findMany({
      where: { status: "PUBLISHED", type: { in: ["CASE", "TIP"] } },
      orderBy: { publishedAt: "desc" },
      include: cardQuery,
      take: 3,
    }),
    prisma.material.findMany({
      where: { status: "PUBLISHED", bookmarks: { some: {} } },
      orderBy: { bookmarks: { _count: "desc" } },
      include: { ...cardQuery, _count: { select: { bookmarks: true } } },
      take: 3,
    }),
    prisma.category.findMany({ where: { kind: "TASK" }, orderBy: { order: "asc" } }),
    prisma.material.groupBy({ by: ["type"], where: { status: "PUBLISHED" }, _count: true }),
  ]);
  const count = (types: string[]) => typeCounts.filter((t) => types.includes(t.type)).reduce((s, t) => s + t._count, 0);

  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="container-page py-12 sm:py-20">
          <p className="eyebrow mb-4">Открытая библиотека и испытательная площадка для учителей</p>
          <h1 className="max-w-4xl font-serif text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Найдите способ решить педагогическую задачу — и поймите, насколько ему можно доверять
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-soft">
            Мы не пересказываем, что умеет технология. Мы описываем, какую задачу она решает, сколько времени и денег требует,
            где ошибается и кем проверена на практике.
          </p>
          <div className="mt-8 max-w-3xl">
            <SearchBox />
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <span>Часто ищут:</span>
              {exampleQueries.map((q) => (
                <Link key={q} href={`/library?q=${encodeURIComponent(q)}`} className="chip hover:border-accent hover:text-accent">
                  {q}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container-page mt-10" aria-labelledby="quick-nav">
        <h2 id="quick-nav" className="sr-only">Разделы</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/library", title: "Библиотека решений", text: "Все материалы с фильтрами по задаче, классу, времени и стоимости.", n: count(["CASE", "TIP", "TOOL_REVIEW", "COMPARISON", "READY_MATERIAL", "INTERACTIVE", "METHOD", "TEMPLATE"]) },
            { href: "/research", title: "Испытания", text: "Сравнения инструментов по заранее заданным критериям.", n: null },
            { href: "/practice", title: "Фишки и кейсы", text: "Что можно сделать уже на ближайшем уроке.", n: count(["CASE", "TIP"]) },
            { href: "/library?type=READY_MATERIAL&type=TEMPLATE&type=INTERACTIVE", title: "Материалы и шаблоны", text: "Готовые рабочие листы, шаблоны и промпты.", n: count(["READY_MATERIAL", "TEMPLATE", "INTERACTIVE"]) },
          ].map((t) => (
            <Link key={t.href} href={t.href} className="card group p-5 hover:border-accent">
              <span className="flex items-baseline justify-between">
                <span className="font-semibold group-hover:text-accent">{t.title}</span>
                {t.n != null && <span className="text-sm text-muted">{t.n}</span>}
              </span>
              <span className="mt-1.5 block text-[14px] text-muted">{t.text}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-page mt-12" aria-labelledby="by-task">
        <h2 id="by-task" className="text-xl font-semibold">Начните с задачи</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {tasks.map((t) => (
            <Link key={t.id} href={`/library?task=${t.slug}`} className="chip px-4 py-2 text-[14px] hover:border-accent hover:text-accent">
              {t.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="container-page mt-14" aria-labelledby="verified">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="verified" className="text-xl font-semibold">Проверенные решения</h2>
            <p className="mt-1 text-[14px] text-muted">Материалы, практическое применение которых подтверждено по критериям лаборатории.</p>
          </div>
          <Link href="/library?verification=AUTHOR_TESTED&verification=MULTI_TEACHER&verification=INDEPENDENT" className="link text-sm">
            Все проверенные
          </Link>
        </div>
        {verified.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {verified.map((m) => <MaterialCard key={m.id} m={m} />)}
          </div>
        ) : (
          <div className="card mt-5 border-dashed p-6 text-[15px] text-ink-soft">
            Пока ни одно решение не получило статус выше «Не тестировалось»: библиотека только запускается, а статусы
            мы не присваиваем авансом.{" "}
            <Link href="/methodology" className="link">Как материал получает статус проверки</Link>
          </div>
        )}
      </section>

      <section className="container-page mt-14" aria-labelledby="research">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="research" className="text-xl font-semibold">Последние испытания лаборатории</h2>
          <Link href="/research" className="link text-sm">Все испытания</Link>
        </div>
        {research.length ? (
          <ul className="mt-5 grid gap-4 md:grid-cols-3">
            {research.map((r) => (
              <li key={r.id} className="card relative flex flex-col p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="eyebrow">{researchKindLabels[r.kind]}</span>
                  {r.isDemo && <DemoBadge label="Учебный пример" />}
                </div>
                <h3 className="mt-2 font-semibold leading-snug">
                  <Link href={`/research/${r.slug}`} className="after:absolute after:inset-0 hover:text-accent">{r.title}</Link>
                </h3>
                <p className="mt-2 line-clamp-3 text-[14px] text-ink-soft">{r.question}</p>
                <p className="mt-auto pt-4 text-[13px] text-muted">
                  {r.tools.length} {r.tools.length === 1 ? "инструмент" : r.tools.length < 5 ? "инструмента" : "инструментов"} ·{" "}
                  {r._count.issues > 0 ? <span className="text-danger">критических ошибок: {r._count.issues}</span> : "критических ошибок нет"} · {formatDate(r.publishedAt)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-muted">Испытания ещё не опубликованы.</p>
        )}
      </section>

      {popular.length > 0 && (
        <section className="container-page mt-14" aria-labelledby="popular">
          <h2 id="popular" className="text-xl font-semibold">Чаще всего сохраняют в избранное</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {popular.map((m) => <MaterialCard key={m.id} m={m} />)}
          </div>
        </section>
      )}

      <section className="container-page mt-14" aria-labelledby="practice">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="practice" className="text-xl font-semibold">Недавно опубликованные кейсы и фишки</h2>
          <Link href="/practice" className="link text-sm">Все фишки и кейсы</Link>
        </div>
        {practice.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {practice.map((m) => <MaterialCard key={m.id} m={m} />)}
          </div>
        ) : (
          <p className="mt-4 text-muted">Кейсы и фишки ещё не опубликованы. <Link href="/submit" className="link">Предложите первый</Link>.</p>
        )}
      </section>

      <section className="container-page mt-16" aria-labelledby="method">
        <div className="card grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="eyebrow">Методика испытаний</p>
            <h2 id="method" className="mt-2 font-serif text-2xl font-semibold sm:text-3xl">Как мы проверяем технологии</h2>
            <ul className="mt-5 space-y-3 text-[15px] leading-relaxed text-ink-soft">
              <li><b className="text-ink">Критерии и веса фиксируются до испытания.</b> После внесения первых результатов их нельзя изменить.</li>
              <li><b className="text-ink">Нет единого балла.</b> Техническая работоспособность, удобство и педагогическая ценность оцениваются отдельно.</li>
              <li><b className="text-ink">Критические ошибки не компенсируются.</b> Неверный ответ в тесте важнее красивого интерфейса.</li>
              <li><b className="text-ink">Мы различаем виды проверки:</b> технические возможности, оценку педагогами и измерение результатов учеников.</li>
            </ul>
            <Link href="/methodology" className="btn-secondary mt-6">Подробнее о методике</Link>
          </div>
          <div>
            <p className="eyebrow">Статусы проверки</p>
            <ul className="mt-4 space-y-3">
              {verificationOrder.map((s) => (
                <li key={s}><VerificationBadge status={s} /></li>
              ))}
            </ul>
            <p className="mt-4 text-[14px] text-muted">Статус меняет редакция, но система не позволит выбрать статус, условия которого не выполнены.</p>
          </div>
        </div>
      </section>

      <section className="container-page mt-12 grid gap-4 md:grid-cols-2" aria-label="Участие">
        <div className="card p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Предложите свою разработку</h2>
          <p className="mt-2 text-[15px] text-ink-soft">
            Опишите приём, кейс или шаблон по единой структуре: задача, шаги, время, ограничения. Редакция проверит заполнение и опубликует материал.
          </p>
          <Link href="/submit" className="btn-primary mt-5">Предложить материал</Link>
        </div>
        <div className="card p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Присоединяйтесь к сообществу</h2>
          <p className="mt-2 text-[15px] text-ink-soft">
            Сохраняйте решения в избранное, пишите, как они сработали у вас, и сообщайте об ошибках. Отзывы о практическом применении помогают материалам получить статус «Проверено несколькими педагогами».
          </p>
          {user ? (
            <Link href="/me" className="btn-secondary mt-5">Перейти в кабинет</Link>
          ) : (
            <Link href="/register" className="btn-secondary mt-5">Зарегистрироваться</Link>
          )}
        </div>
      </section>
    </>
  );
}
