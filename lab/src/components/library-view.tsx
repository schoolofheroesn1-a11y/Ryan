import Link from "next/link";
import type { MaterialType } from "@prisma/client";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { FilterForm } from "./auto-submit";
import { MaterialCard } from "./material-card";
import { Pagination } from "./pagination";
import { EmptyState } from "./ui/empty-state";
import {
  costLabels,
  formatLabels,
  materialTypeLabels,
  materialTypeOrder,
  skillLabels,
  verificationLabels,
  verificationOrder,
} from "@/lib/labels";
import { activeFilterCount, filtersToQuery, type LibraryFilters } from "@/lib/search-params";
import { countByType, getTaxonomy, searchMaterials } from "@/server/search";

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function Select({ name, label, value, options, prefix }: { prefix: string; name: string; label: string; value: string | null; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label htmlFor={`${prefix}-${name}`} className="mb-1.5 block text-[13px] font-semibold text-ink">{label}</label>
      <select id={`${prefix}-${name}`} name={name} defaultValue={value ?? ""} className={`input py-1.5 text-[14px] ${value ? "border-accent bg-accent-soft/50" : ""}`}>
        <option value="">Любой</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function Checks({ name, legend, values, options }: { name: string; legend: string; values: string[]; options: { value: string; label: string }[] }) {
  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-semibold text-ink">{legend}</legend>
      <div className="flex flex-col gap-1.5">
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-start gap-2.5 rounded-md text-[14px] text-ink-soft hover:text-ink">
            <input type="checkbox" name={name} value={o.value} defaultChecked={values.includes(o.value)} className="mt-[3px] h-4 w-4 shrink-0 accent-[var(--color-accent)]" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Каталог: общий для «Библиотеки» и «Фишек и кейсов».
 * basePath — адрес страницы, fixedTypes — типы, которыми ограничен раздел.
 */
export async function LibraryView({
  filters,
  basePath,
  fixedTypes,
}: {
  filters: LibraryFilters;
  basePath: string;
  fixedTypes?: MaterialType[];
}) {
  const effective = fixedTypes && filters.types.length === 0 ? { ...filters, types: fixedTypes } : filters;
  const [{ items, total, pages }, taxonomy, typeCounts] = await Promise.all([
    searchMaterials(effective),
    getTaxonomy(),
    countByType(filters, fixedTypes),
  ]);
  const active = activeFilterCount(filters);
  const typeList = fixedTypes ?? materialTypeOrder;
  const allCount = typeList.reduce((s, t) => s + (typeCounts[t] ?? 0), 0);
  const href = (patch: Partial<LibraryFilters>) => `${basePath}${filtersToQuery(filters, { page: 1, ...patch })}`;
  const cleared: Partial<LibraryFilters> = { types: [], subject: null, grade: null, task: null, tech: null, prep: null, cost: [], skill: null, format: null, verification: [], period: null };

  // Активные фильтры в виде чипов, каждый можно снять отдельно
  const name = (list: { slug: string; name: string }[], slug: string | null) => list.find((c) => c.slug === slug)?.name ?? slug;
  const chips: { label: string; patch: Partial<LibraryFilters> }[] = [
    ...filters.types.map((t) => ({ label: materialTypeLabels[t], patch: { types: filters.types.filter((x) => x !== t) } })),
    ...(filters.task ? [{ label: name(taxonomy.tasks, filters.task)!, patch: { task: null } }] : []),
    ...(filters.subject ? [{ label: name(taxonomy.subjects, filters.subject)!, patch: { subject: null } }] : []),
    ...(filters.grade ? [{ label: `${filters.grade} класс`, patch: { grade: null } }] : []),
    ...(filters.tech ? [{ label: name(taxonomy.techs, filters.tech)!, patch: { tech: null } }] : []),
    ...(filters.prep ? [{ label: { "15": "подготовка до 15 мин", "60": "подготовка до 1 ч", more: "подготовка больше 1 ч" }[filters.prep], patch: { prep: null } }] : []),
    ...filters.cost.map((c) => ({ label: costLabels[c], patch: { cost: filters.cost.filter((x) => x !== c) } })),
    ...(filters.skill ? [{ label: skillLabels[filters.skill], patch: { skill: null } }] : []),
    ...(filters.format ? [{ label: formatLabels[filters.format], patch: { format: null } }] : []),
    ...filters.verification.map((v) => ({ label: verificationLabels[v], patch: { verification: filters.verification.filter((x) => x !== v) } })),
    ...(filters.period ? [{ label: { "30": "за 30 дней", "90": "за 3 месяца", "365": "за год" }[filters.period], patch: { period: null } }] : []),
  ];

  const filterPanel = (prefix: string) => (
    <FilterForm className="flex flex-col gap-6">
      <input type="hidden" name="q" value={filters.q} />
      {filters.types.map((t) => <input key={t} type="hidden" name="type" value={t} />)}
      {filters.sort !== (filters.q ? "relevance" : "new") && <input type="hidden" name="sort" value={filters.sort} />}
      <Select prefix={prefix} name="task" label="Педагогическая задача" value={filters.task} options={taxonomy.tasks.map((c) => ({ value: c.slug, label: c.name }))} />
      <Select prefix={prefix} name="subject" label="Предмет" value={filters.subject} options={taxonomy.subjects.map((c) => ({ value: c.slug, label: c.name }))} />
      <Select prefix={prefix} name="grade" label="Класс" value={filters.grade ? String(filters.grade) : null} options={Array.from({ length: 11 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} класс` }))} />
      <Select prefix={prefix} name="prep" label="Время подготовки" value={filters.prep} options={[{ value: "15", label: "до 15 минут" }, { value: "60", label: "до 1 часа" }, { value: "more", label: "больше часа" }]} />
      <Checks name="cost" legend="Стоимость" values={filters.cost} options={Object.entries(costLabels).map(([value, label]) => ({ value, label }))} />
      <Checks name="verification" legend="Статус проверки" values={filters.verification} options={verificationOrder.map((v) => ({ value: v, label: verificationLabels[v] }))} />
      <details className="group" open={!!(filters.tech || filters.skill || filters.format || filters.period)}>
        <summary className="cursor-pointer list-none text-[13px] font-semibold text-accent">
          <span className="group-open:hidden">+ Ещё фильтры</span>
          <span className="hidden group-open:inline">− Скрыть дополнительные</span>
        </summary>
        <div className="mt-4 flex flex-col gap-6">
          <Select prefix={prefix} name="tech" label="Тип технологии" value={filters.tech} options={taxonomy.techs.map((c) => ({ value: c.slug, label: c.name }))} />
          <Select prefix={prefix} name="skill" label="Цифровые навыки" value={filters.skill} options={Object.entries(skillLabels).map(([value, label]) => ({ value, label }))} />
          <Select prefix={prefix} name="format" label="Формат проведения" value={filters.format} options={Object.entries(formatLabels).map(([value, label]) => ({ value, label }))} />
          <Select prefix={prefix} name="period" label="Дата публикации" value={filters.period} options={[{ value: "30", label: "за 30 дней" }, { value: "90", label: "за 3 месяца" }, { value: "365", label: "за год" }]} />
        </div>
      </details>
      <noscript>
        <button type="submit" className="btn-primary w-full">Применить</button>
      </noscript>
    </FilterForm>
  );

  return (
    <div className="container-page grid grid-cols-1 gap-8 py-8 lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside aria-label="Фильтры">
        <details className="card-raised p-4 lg:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-medium" data-testid="filters-mobile-toggle">
            <SlidersHorizontal aria-hidden className="h-4 w-4 text-accent" /> Фильтры
            {active > 0 && <span className="rounded-full bg-accent px-2 text-[12px] text-white">{active}</span>}
          </summary>
          <div className="mt-5">{filterPanel("fm")}</div>
        </details>
        <div className="card-raised hidden p-5 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto" data-testid="filters-desktop">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold"><SlidersHorizontal aria-hidden className="h-4 w-4 text-accent" /> Фильтры</h2>
            {active > 0 && (
              <Link href={href(cleared)} className="text-[13px] font-medium text-accent hover:underline">
                Сбросить ({active})
              </Link>
            )}
          </div>
          {filterPanel("fd")}
        </div>
      </aside>

      <section aria-labelledby="results-heading" className="min-w-0">
        <form method="get" action={basePath} role="search" className="flex gap-2">
          <label htmlFor="library-q" className="sr-only">Поиск</label>
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
            <input id="library-q" type="search" name="q" defaultValue={filters.q} placeholder="Задача, тема, инструмент или приём" className="input h-12 pl-10 text-[15.5px] shadow-[var(--shadow-card)]" maxLength={200} />
          </div>
          {filters.types.map((t) => <input key={t} type="hidden" name="type" value={t} />)}
          <button type="submit" className="btn-primary h-12 px-6">Найти</button>
        </form>

        <nav aria-label="Типы материалов" className="-mx-1 mt-5 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <Link
            href={href({ types: [] })}
            aria-current={filters.types.length === 0 ? "true" : undefined}
            className={`chip shrink-0 ${filters.types.length === 0 ? "border-ink bg-ink text-white" : "hover:border-accent hover:text-accent"}`}
          >
            Все <span className="opacity-70">{allCount}</span>
          </Link>
          {typeList.map((t) => {
            const n = typeCounts[t] ?? 0;
            const on = filters.types.length === 1 && filters.types[0] === t;
            if (!n && !on) return null;
            return (
              <Link key={t} href={href({ types: [t] })} aria-current={on ? "true" : undefined} className={`chip shrink-0 ${on ? "border-ink bg-ink text-white" : "hover:border-accent hover:text-accent"}`}>
                {materialTypeLabels[t]} <span className="opacity-70">{n}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p id="results-heading" className="text-[15px]" aria-live="polite">
            {filters.q ? <>По запросу «<b>{filters.q}</b>» </> : null}
            {total === 0 ? "ничего не найдено" : <>найдено <b>{total}</b> {plural(total, "материал", "материала", "материалов")}</>}
          </p>
          <nav aria-label="Сортировка" className="flex flex-wrap items-center gap-1 text-[13px]">
            <span className="mr-1 text-muted">Сортировать:</span>
            {([...(filters.q ? [["relevance", "по релевантности"]] : []), ["new", "новые"], ["updated", "обновлённые"], ["prep", "быстрая подготовка"]] as [LibraryFilters["sort"], string][]).map(([key, label]) => (
              <Link key={key} href={`${basePath}${filtersToQuery(filters, { sort: key, page: 1 })}`} aria-current={filters.sort === key ? "true" : undefined} className={`whitespace-nowrap rounded-lg px-2.5 py-1 ${filters.sort === key ? "bg-accent-soft font-medium text-accent" : "text-ink-soft hover:bg-neutral-soft"}`}>
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {chips.length > 0 && (
          <ul className="mt-3 flex flex-wrap items-center gap-2" aria-label="Выбранные фильтры">
            {chips.map((c) => (
              <li key={c.label}>
                <Link href={href(c.patch)} className="chip border-accent/30 bg-accent-soft text-accent hover:border-accent" aria-label={`Убрать фильтр «${c.label}»`}>
                  {c.label} <X aria-hidden className="h-3.5 w-3.5" />
                </Link>
              </li>
            ))}
            <li>
              <Link href={`${basePath}${filters.q ? `?q=${encodeURIComponent(filters.q)}` : ""}`} className="text-[13.5px] font-medium text-danger hover:underline" data-testid="reset-filters">
                Сбросить фильтры ({active})
              </Link>
            </li>
          </ul>
        )}

        {items.length ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {items.map((m) => <MaterialCard key={m.id} m={m} headingLevel={2} />)}
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              title="Подходящих материалов нет"
              action={
                <div className="flex flex-wrap gap-2">
                  {active > 0 && <Link href={`${basePath}${filters.q ? `?q=${encodeURIComponent(filters.q)}` : ""}`} className="btn-secondary">Сбросить фильтры</Link>}
                  {filters.q && <Link href={basePath} className="btn-secondary">Очистить поиск</Link>}
                  <Link href="/submit" className="btn-ghost">Предложить материал на эту тему</Link>
                </div>
              }
            >
              Попробуйте сформулировать задачу иначе (например, «проверка понимания» вместо «тест»), убрать часть фильтров или выбрать задачу из списка.
            </EmptyState>
          </div>
        )}
        <Pagination page={filters.page} pages={pages} hrefFor={(p) => `${basePath}${filtersToQuery(filters, { page: p })}`} />
      </section>
    </div>
  );
}
