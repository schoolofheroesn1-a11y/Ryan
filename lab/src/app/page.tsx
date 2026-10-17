import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Clock,
  FlaskConical,
  GraduationCap,
  Layers,
  Lightbulb,
  ListChecks,
  MessageSquare,
  Repeat,
  Sparkles,
  Target,
  Timer,
  TriangleAlert,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { MaterialCard } from "@/components/material-card";
import { SearchBox } from "@/components/search-box";
import { DemoBadge, TypeLabel, VerificationBadge } from "@/components/ui/badges";
import { prisma } from "@/lib/db";
import { formatDate, formatGrades, formatMinutes } from "@/lib/format";
import { costLabels, researchKindLabels, verificationLabels } from "@/lib/labels";
import { verificationCriteria } from "@/lib/verification";
import { getCurrentUser } from "@/server/auth";
import { cardInclude } from "@/server/materials";
import { listPublishedResearch } from "@/server/research";

const cardQuery = { ...cardInclude, categories: { include: { category: true } } } as const;

const exampleQueries = ["рефлексия", "разноуровневые задания", "проверка понимания", "дискуссия", "игра без программирования", "промпт"];

const taskIcons: Record<string, LucideIcon> = {
  reflection: MessageSquare,
  differentiation: Layers,
  assessment: ListChecks,
  engagement: Sparkles,
  discussion: Users,
  "new-material": Lightbulb,
  practice: Repeat,
  projects: Target,
  "lesson-prep": Timer,
  reading: BookOpen,
};

const ladder = ["NOT_TESTED", "AUTHOR_TESTED", "MULTI_TEACHER", "INDEPENDENT"] as const;

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export default async function HomePage() {
  const [user, verified, research, practice, popular, tasks, taskCounts, typeCounts, specimen] = await Promise.all([
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
      include: cardQuery,
      take: 3,
    }),
    prisma.category.findMany({ where: { kind: "TASK" }, orderBy: { order: "asc" } }),
    prisma.materialCategory.groupBy({ by: ["categoryId"], where: { material: { status: "PUBLISHED" } }, _count: true }),
    prisma.material.groupBy({ by: ["type"], where: { status: "PUBLISHED" }, _count: true }),
    prisma.material.findFirst({
      where: { status: "PUBLISHED", type: { in: ["TIP", "CASE"] } },
      orderBy: { publishedAt: "desc" },
      include: { categories: { include: { category: true } } },
    }),
  ]);
  const count = (types: string[]) => typeCounts.filter((t) => types.includes(t.type)).reduce((s, t) => s + t._count, 0);
  const total = count(["CASE", "TIP", "TOOL_REVIEW", "COMPARISON", "READY_MATERIAL", "INTERACTIVE", "METHOD", "TEMPLATE"]);
  const tasksWithCount = tasks.map((t) => ({ ...t, n: taskCounts.find((c) => c.categoryId === t.id)?._count ?? 0 }));

  return (
    <>
      {/* Первый экран: поиск и «паспорт решения» — так выглядит любой материал библиотеки */}
      <section className="border-b-[3px] border-ink bg-page">
        <div className="container-page grid items-center gap-12 py-12 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
          <div className="min-w-0">
            <p className="tag-label inline-flex items-center gap-2">
              <FlaskConical aria-hidden className="h-3.5 w-3.5" /> Открытая библиотека и испытательная площадка для учителей
            </p>
            <h1 className="mt-6 font-display text-[30px] font-semibold leading-[1.12] tracking-tight sm:text-[44px] lg:text-[50px]">
              Найдите способ решить задачу урока — и <span className="marker">поймите, можно ли ему доверять</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-soft">
              Мы не пересказываем, что умеет технология. Каждое решение описано одинаково: какую задачу решает, сколько времени и денег требует,
              где ошибается и кем проверено.
            </p>
            <div className="mt-8 max-w-2xl">
              <SearchBox />
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                <span>Например:</span>
                {exampleQueries.map((q) => (
                  <Link key={q} href={`/library?q=${encodeURIComponent(q)}`} className="chip hover:border-accent hover:bg-accent-soft hover:text-accent">
                    {q}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {specimen && (
            <div className="relative mx-auto w-full max-w-md lg:mx-0">
              <p aria-hidden className="pointer-events-none absolute -top-9 right-2 hidden font-mono text-[12px] font-bold uppercase tracking-[0.08em] leading-none text-danger sm:block">
                так описан каждый материал ↓
              </p>
              <Link href={`/m/${specimen.slug}`} className="group block border-[3px] border-ink bg-surface p-6 shadow-[9px_9px_0_0_var(--color-cyan)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[12px_12px_0_0_var(--color-cyan)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="eyebrow">Паспорт решения</span>
                  <TypeLabel type={specimen.type} />
                </div>
                <p className="mt-3 text-[18px] font-semibold leading-snug group-hover:text-accent">{specimen.title}</p>
                <dl className="mt-5 grid grid-cols-2 gap-3 text-[13.5px]">
                  <div className="rounded-xl bg-paper p-3">
                    <dt className="flex items-center gap-1.5 text-muted"><Clock aria-hidden className="h-3.5 w-3.5" /> Подготовка</dt>
                    <dd className="mt-1 font-semibold">{formatMinutes(specimen.prepTimeMin)}</dd>
                  </div>
                  <div className="rounded-xl bg-paper p-3">
                    <dt className="flex items-center gap-1.5 text-muted"><Timer aria-hidden className="h-3.5 w-3.5" /> На уроке</dt>
                    <dd className="mt-1 font-semibold">{formatMinutes(specimen.lessonTimeMin)}</dd>
                  </div>
                  <div className="rounded-xl bg-paper p-3">
                    <dt className="flex items-center gap-1.5 text-muted"><GraduationCap aria-hidden className="h-3.5 w-3.5" /> Классы</dt>
                    <dd className="mt-1 font-semibold">{formatGrades(specimen.gradeFrom, specimen.gradeTo)}</dd>
                  </div>
                  <div className="rounded-xl bg-paper p-3">
                    <dt className="flex items-center gap-1.5 text-muted"><Wallet aria-hidden className="h-3.5 w-3.5" /> Стоимость</dt>
                    <dd className="mt-1 font-semibold">{costLabels[specimen.cost]}</dd>
                  </div>
                </dl>
                <div className="mt-4 rounded-xl border border-danger/20 bg-danger-soft/60 p-3 text-[13.5px]">
                  <p className="flex items-center gap-1.5 font-medium text-danger"><TriangleAlert aria-hidden className="h-3.5 w-3.5" /> Ограничения</p>
                  <p className="mt-1 line-clamp-2 text-ink-soft">{specimen.limitations}</p>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <VerificationBadge status={specimen.verificationStatus} size="sm" />
                  <span className="inline-flex items-center gap-1 text-[13px] font-medium text-accent">
                    Открыть <ArrowRight aria-hidden className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
              <p aria-hidden className="pointer-events-none mt-3 hidden pl-6 font-mono text-[12px] font-bold uppercase tracking-[0.08em] leading-none text-ok sm:block">
                статус — по критериям, а не «на глаз»
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="container-page mt-14" aria-labelledby="by-task">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="tag-label">С чего начать</p>
            <h2 id="by-task" className="mt-2 font-display text-[22px] font-semibold tracking-tight sm:text-[26px]">Какую задачу вы решаете?</h2>
          </div>
          <Link href="/library" className="inline-flex items-center gap-1.5 text-[14px] font-medium text-accent hover:underline">
            Вся библиотека · {total} {plural(total, "материал", "материала", "материалов")} <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </div>
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {tasksWithCount.map((t) => {
            const Icon = taskIcons[t.slug] ?? Lightbulb;
            return (
              <li key={t.id}>
                <Link href={`/library?task=${t.slug}`} className="card group flex h-full items-start gap-3 p-4 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:bg-marker hover:shadow-[var(--shadow-card)] lg:flex-col">
                  <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-[14.5px] font-medium leading-snug">{t.name}</span>
                    <span className="mt-1 block text-[12.5px] text-muted">
                      {t.n ? `${t.n} ${plural(t.n, "решение", "решения", "решений")}` : "пока нет решений"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="container-page mt-16" aria-labelledby="practice">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="tag-label">На ближайший урок</p>
            <h2 id="practice" className="mt-2 font-display text-[22px] font-semibold tracking-tight sm:text-[26px]">Свежие фишки и кейсы</h2>
          </div>
          <Link href="/practice" className="inline-flex items-center gap-1.5 text-[14px] font-medium text-accent hover:underline">
            Все фишки и кейсы ({count(["CASE", "TIP"])}) <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </div>
        {practice.length ? (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {practice.map((m) => <MaterialCard key={m.id} m={m} />)}
          </div>
        ) : (
          <p className="mt-4 text-muted">Кейсы и фишки ещё не опубликованы. <Link href="/submit" className="link">Предложите первый</Link>.</p>
        )}
      </section>

      <section className="container-page mt-16" aria-labelledby="research">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_2fr]">
          <div>
            <p className="tag-label">Лаборатория испытаний</p>
            <h2 id="research" className="mt-2 font-display text-[22px] font-semibold tracking-tight sm:text-[26px]">Что показали испытания</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              Сравниваем инструменты на одинаковых заданиях по заранее зафиксированным критериям. Критические ошибки показываем первой строкой.
            </p>
            <Link href="/research" className="btn-secondary mt-5">Все испытания <ArrowRight aria-hidden className="h-4 w-4" /></Link>
          </div>
          {research.length ? (
            <ul className="grid gap-4 md:grid-cols-2">
              {research.map((r) => (
                <li key={r.id} className="card-raised group relative flex flex-col p-5 transition-shadow hover:shadow-[var(--shadow-lift)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="eyebrow">{researchKindLabels[r.kind]}</span>
                    {r.isDemo && <DemoBadge label="Учебный пример" />}
                  </div>
                  <h3 className="mt-3 font-semibold leading-snug">
                    <Link href={`/research/${r.slug}`} className="after:absolute after:inset-0 group-hover:text-accent">{r.title}</Link>
                  </h3>
                  <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-ink-soft">{r.question}</p>
                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-[13px] text-muted">
                    <span>{r.tools.length} {plural(r.tools.length, "участник", "участника", "участников")}</span>
                    {r._count.issues > 0 ? (
                      <span className="inline-flex items-center gap-1 font-medium text-danger"><TriangleAlert aria-hidden className="h-3.5 w-3.5" /> критических ошибок: {r._count.issues}</span>
                    ) : (
                      <span className="text-ok">критических ошибок нет</span>
                    )}
                    <span>{formatDate(r.publishedAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Испытания ещё не опубликованы.</p>
          )}
        </div>
      </section>

      <section className="container-page mt-16" aria-labelledby="ladder">
        <div className="overflow-hidden border-[3px] border-ink bg-surface shadow-[9px_9px_0_0_var(--color-cyan)]">
          <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[1fr_1.3fr]">
            <div>
              <p className="tag-label">Лестница доверия</p>
              <h2 id="ladder" className="mt-2 font-display text-[22px] font-semibold tracking-tight sm:text-[26px]">Статус проверки нужно заслужить</h2>
              <p className="mt-4 text-[15.5px] leading-relaxed text-ink-soft">
                Каждая ступень — это конкретные условия, которые проверяет сервер. Редакция не может поднять статус «на глаз», а критерии испытаний
                фиксируются до получения результатов.
              </p>
              <ul className="mt-5 space-y-2.5 text-[14.5px] text-ink-soft">
                <li className="flex gap-2"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />Нет единого балла — техника, удобство и педагогика оцениваются отдельно.</li>
                <li className="flex gap-2"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />Критическая ошибка не компенсируется красивым интерфейсом.</li>
                <li className="flex gap-2"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ok" />Впечатления автора не выдаются за доказательство эффективности.</li>
              </ul>
              <Link href="/methodology" className="btn-secondary mt-6">Как устроена методика</Link>
            </div>
            <ol className="flex items-end gap-2 sm:gap-3" aria-label="Ступени статусов проверки, от низшей к высшей">
              {ladder.map((s, i) => (
                <li key={s} className="flex min-w-0 flex-1 flex-col justify-end">
                  <div
                    className={`flex flex-col justify-between rounded-t-xl border border-b-0 p-3 sm:p-4 ${
                      i === 3 ? "border-ok bg-ok text-white" : i === 2 ? "border-ok/30 bg-ok-soft" : i === 1 ? "border-info/30 bg-info-soft" : "border-line bg-paper"
                    }`}
                    style={{ minHeight: `${7 + i * 3.4}rem` }}
                  >
                    <span className={`font-display text-[20px] font-semibold ${i === 3 ? "text-white/70" : "text-muted"}`}>{i + 1}</span>
                    <span>
                      <span className="block text-[12.5px] font-semibold leading-tight sm:text-[13.5px]">{verificationLabels[s]}</span>
                      <span className={`mt-1 hidden text-[12px] leading-snug xl:block ${i === 3 ? "text-white/80" : "text-muted"}`}>{verificationCriteria[s].summary}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <p className="border-t border-line bg-warn-soft/60 px-6 py-3 text-[13.5px] text-warn sm:px-10">
            Отдельный статус «{verificationLabels.NEEDS_RECHECK}» назначается, если инструмент обновился или пришла подтверждённая жалоба.
          </p>
        </div>
      </section>

      <section className="container-page mt-16" aria-labelledby="verified">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="tag-label">Проверено на практике</p>
            <h2 id="verified" className="mt-2 font-display text-[22px] font-semibold tracking-tight sm:text-[26px]">Проверенные решения</h2>
          </div>
          <Link href="/library?verification=AUTHOR_TESTED&verification=MULTI_TEACHER&verification=INDEPENDENT" className="inline-flex items-center gap-1.5 text-[14px] font-medium text-accent hover:underline">
            Все проверенные <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </div>
        {verified.length ? (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {verified.map((m) => <MaterialCard key={m.id} m={m} />)}
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-4 rounded-[var(--radius-card)] border-2 border-dashed border-line-strong bg-surface/70 p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-[15px] leading-relaxed text-ink-soft">
              Пока ни одно решение не поднялось выше первой ступени: библиотека только запускается, а статусы мы не выдаём авансом.
              Ваш отзыв о применении на практике может стать первым шагом.
            </p>
            <p className="shrink-0 font-mono text-[12px] font-bold uppercase tracking-[0.08em] leading-none text-ok">ждём ваш опыт!</p>
          </div>
        )}
      </section>

      {popular.length > 0 && (
        <section className="container-page mt-16" aria-labelledby="popular">
          <h2 id="popular" className="font-display text-[22px] font-semibold tracking-tight sm:text-[26px]">Чаще всего сохраняют в избранное</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {popular.map((m) => <MaterialCard key={m.id} m={m} />)}
          </div>
        </section>
      )}

      <section className="container-page mt-16 grid gap-4 md:grid-cols-[1.3fr_1fr]" aria-label="Участие">
        <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-accent p-7 text-white sm:p-10">
          <h2 className="font-display text-[22px] font-semibold tracking-tight sm:text-[26px]">Есть приём, который работает у вас?</h2>
          <p className="mt-3 max-w-lg text-[15.5px] leading-relaxed text-white/85">
            Опишите его по единой структуре: задача, шаги, время, ограничения. Редакция проверит заполнение и опубликует материал — с вашим именем.
          </p>
          <Link href="/submit" className="btn mt-6 bg-marker font-semibold text-ink shadow-[0_2px_0_#c9b400] hover:-translate-y-px">
            Предложить материал <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
          <p aria-hidden className="absolute bottom-5 right-6 hidden font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-marker/90 md:block">ваш кейс здесь</p>
        </div>
        <div className="card-raised p-7 sm:p-10">
          <h2 className="font-display text-[20px] font-semibold tracking-tight">Присоединяйтесь</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            Сохраняйте решения в избранное, пишите, как они сработали у вас, и сообщайте об ошибках.
          </p>
          {user ? (
            <Link href="/me" className="btn-secondary mt-6">Перейти в кабинет</Link>
          ) : (
            <Link href="/register" className="btn-secondary mt-6">Зарегистрироваться</Link>
          )}
        </div>
      </section>
    </>
  );
}
