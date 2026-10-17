import Link from "next/link";
import { FilterForm } from "./auto-submit";
import { MaterialCard } from "./material-card";
import { Pagination } from "./pagination";
import { EmptyState } from "./ui/empty-state";
import {
  costLabels,
  formatLabels,
  materialTypeLabels,
  skillLabels,
  verificationLabels,
  verificationOrder,
} from "@/lib/labels";
import { activeFilterCount, filtersToQuery, type LibraryFilters } from "@/lib/search-params";
import type { MaterialType } from "@prisma/client";
import { getTaxonomy, searchMaterials } from "@/server/search";

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
      <label htmlFor={`${prefix}-${name}`} className="mb-1 block text-[13px] font-medium text-ink-soft">{label}</label>
      <select id={`${prefix}-${name}`} name={name} defaultValue={value ?? ""} className="input py-1.5 text-[14px]">
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
      <legend className="mb-1.5 text-[13px] font-medium text-ink-soft">{legend}</legend>
      <div className="flex flex-col gap-1">
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-start gap-2 text-[14px]">
            <input type="checkbox" name={name} value={o.value} defaultChecked={values.includes(o.value)} className="mt-1 accent-[var(--color-accent)]" />
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
  const [{ items, total, pages }, taxonomy] = await Promise.all([searchMaterials(effective), getTaxonomy()]);
  const active = activeFilterCount(filters);
  const typeOptions = (fixedTypes ?? (Object.keys(materialTypeLabels) as MaterialType[])).map((t) => ({ value: t, label: materialTypeLabels[t] }));

  const filterPanel = (prefix: string) => (
    <FilterForm className="flex flex-col gap-5">
      <input type="hidden" name="q" value={filters.q} />
      {filters.sort !== (filters.q ? "relevance" : "new") && <input type="hidden" name="sort" value={filters.sort} />}
      {typeOptions.length > 1 && <Checks name="type" legend="Тип материала" values={filters.types} options={typeOptions} />}
      <Select prefix={prefix} name="task" label="Педагогическая задача" value={filters.task} options={taxonomy.tasks.map((c) => ({ value: c.slug, label: c.name }))} />
      <Select prefix={prefix} name="subject" label="Предмет" value={filters.subject} options={taxonomy.subjects.map((c) => ({ value: c.slug, label: c.name }))} />
      <Select prefix={prefix} name="grade" label="Класс" value={filters.grade ? String(filters.grade) : null} options={Array.from({ length: 11 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} класс` }))} />
      <Select prefix={prefix} name="tech" label="Тип технологии" value={filters.tech} options={taxonomy.techs.map((c) => ({ value: c.slug, label: c.name }))} />
      <Select prefix={prefix} name="prep" label="Время подготовки" value={filters.prep} options={[{ value: "15", label: "до 15 минут" }, { value: "60", label: "до 1 часа" }, { value: "more", label: "больше часа" }]} />
      <Checks name="cost" legend="Стоимость" values={filters.cost} options={Object.entries(costLabels).map(([value, label]) => ({ value, label }))} />
      <Select prefix={prefix} name="skill" label="Цифровые навыки" value={filters.skill} options={Object.entries(skillLabels).map(([value, label]) => ({ value, label }))} />
      <Select prefix={prefix} name="format" label="Формат проведения" value={filters.format} options={Object.entries(formatLabels).map(([value, label]) => ({ value, label }))} />
      <Checks name="verification" legend="Статус проверки" values={filters.verification} options={verificationOrder.map((v) => ({ value: v, label: verificationLabels[v] }))} />
      <Select prefix={prefix} name="period" label="Дата публикации" value={filters.period} options={[{ value: "30", label: "за 30 дней" }, { value: "90", label: "за 3 месяца" }, { value: "365", label: "за год" }]} />
      <noscript>
        <button type="submit" className="btn-primary w-full">Применить</button>
      </noscript>
    </FilterForm>
  );

  return (
    <div className="container-page grid grid-cols-1 gap-8 py-8 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside aria-label="Фильтры">
        <details className="card p-4 lg:hidden" open={false}>
          <summary className="cursor-pointer font-medium">
            Фильтры{active > 0 && <span className="ml-1 text-accent">({active})</span>}
          </summary>
          <div className="mt-4">{filterPanel("fm")}</div>
        </details>
        <div className="hidden lg:block" data-testid="filters-desktop">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Фильтры</h2>
            {active > 0 && (
              <Link href={`${basePath}${filtersToQuery({ ...filters, types: [], subject: null, grade: null, task: null, tech: null, prep: null, cost: [], skill: null, format: null, verification: [], period: null, page: 1 })}`} className="text-[13px] text-accent hover:underline">
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
          <input id="library-q" type="search" name="q" defaultValue={filters.q} placeholder="Задача, тема, инструмент или приём" className="input h-11 flex-1" maxLength={200} />
          {filters.types.map((t) => <input key={t} type="hidden" name="type" value={t} />)}
          <button type="submit" className="btn-primary h-11">Найти</button>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p id="results-heading" className="text-[15px]" aria-live="polite">
            {filters.q ? <>По запросу «<b>{filters.q}</b>» </> : null}
            {total === 0 ? "ничего не найдено" : <>найдено <b>{total}</b> {plural(total, "материал", "материала", "материалов")}</>}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {active > 0 && (
              <Link href={`${basePath}${filters.q ? `?q=${encodeURIComponent(filters.q)}` : ""}`} className="text-[14px] text-accent hover:underline" data-testid="reset-filters">
                Сбросить фильтры ({active})
              </Link>
            )}
            <nav aria-label="Сортировка" className="flex flex-wrap items-center gap-1 text-[13px]">
              <span className="text-muted">Сортировать:</span>
              {([...(filters.q ? [["relevance", "по релевантности"]] : []), ["new", "новые"], ["updated", "обновлённые"], ["prep", "быстрая подготовка"]] as [LibraryFilters["sort"], string][]).map(([key, label]) => (
                <Link key={key} href={`${basePath}${filtersToQuery(filters, { sort: key, page: 1 })}`} aria-current={filters.sort === key ? "true" : undefined} className={`whitespace-nowrap rounded-md px-2 py-1 ${filters.sort === key ? "bg-ink text-paper" : "text-ink-soft hover:bg-neutral-soft"}`}>
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {items.length ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {items.map((m) => <MaterialCard key={m.id} m={m} headingLevel={2} />)}
          </div>
        ) : (
          <div className="mt-5">
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
