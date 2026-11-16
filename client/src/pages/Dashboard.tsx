import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Award, School, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../App';
import { Card, CardHeader, Empty, Spinner } from '../components/ui';
import { ChartEmpty, PercentBars, SERIES_COLORS } from '../components/charts';
import { fmtDate, fmtPct, pctFill, pctText } from '../lib/format';
import { CATEGORY_STYLE } from '../lib/meta';
import { HEALTH } from './student/Goals';

function greeting() {
  const h = new Date().getHours();
  return h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
}

export function DashboardPage() {
  const { user } = useApp();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get('/api/dashboard').then(setData);
  }, []);

  if (!data) return <Spinner />;
  const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const firstClass = data.classes[0];
  const behind = (data.goalStats.behind || 0) + (data.goalStats.overdue || 0);

  return (
    <div className="page-in space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[22px] border border-border/80 bg-white px-6 py-8 shadow-soft sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-brand-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-amber-100/70 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-end">
          <div>
            <div className="eyebrow">{today}</div>
            <h1 className="mt-2 text-[34px] leading-tight text-ink sm:text-[40px]">{greeting()}, {user!.name}</h1>
            <p className="mt-3 max-w-xl text-slate-600">
              {data.totals.students
                ? <>Сегодня в фокусе: <b className="text-ink">{data.atRisk.length}</b> {plural(data.atRisk.length, 'ученик требует', 'ученика требуют', 'учеников требуют')} внимания
                    {behind ? <>, <b className="text-ink">{behind}</b> {plural(behind, 'цель отстаёт', 'цели отстают', 'целей отстают')} от плана</> : null}.</>
                : 'Начните с создания классов и учеников — дальше портфолио, цели и аналитика соберутся сами.'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Успеваемость', value: fmtPct(data.totals.percent), cls: pctText(data.totals.percent) },
              { label: 'Учеников', value: data.totals.students, cls: 'text-ink' },
              { label: 'Целей в работе', value: data.goalStats.total || 0, cls: 'text-ink' },
              { label: 'Материалов в банке', value: data.totals.materials, cls: 'text-ink' },
            ].map((k) => (
              <div key={k.label} className="rounded-2xl border border-border/70 bg-slate-50/80 px-4 py-3">
                <div className={`font-mono text-[28px] font-semibold leading-none ${k.cls}`}>{k.value}</div>
                <div className="mt-1.5 text-xs uppercase tracking-wide text-muted">{k.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick start */}
      {firstClass && (
        <section>
          <h2 className="mb-4 text-xl text-ink">Быстрый старт</h2>
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { emoji: '📝', bg: 'bg-brand-50', title: 'Выставить оценки', text: 'Проценты, баллы или отметки — всему классу', to: `/classes/${firstClass.id}` },
              { emoji: '🎯', bg: 'bg-amber-50', title: 'Поставить цель', text: 'Откройте ученика и задайте понятную цель', to: data.atRisk[0] ? `/students/${data.atRisk[0].id}` : `/classes/${firstClass.id}` },
              { emoji: '📚', bg: 'bg-violet-50', title: 'Пополнить банк', text: 'Рефлексия, характеристики, работы, переписка', to: `/classes/${firstClass.id}` },
              { emoji: '📊', bg: 'bg-sky-50', title: 'Аналитика класса', text: 'Предметы, качества, цели и советы ИИ', to: `/classes/${firstClass.id}?tab=analytics` },
            ].map((q) => (
              <Link key={q.title} to={q.to} className="group block h-full rounded-[14px] border border-border/80 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-brand-300">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${q.bg}`}>{q.emoji}</div>
                <div className="mt-3 font-semibold text-ink">{q.title}</div>
                <div className="mt-1 text-sm text-muted">{q.text}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Classes as course modules */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl text-ink">Классы</h2>
            <p className="mt-1 text-sm text-muted">Успеваемость, посещаемость и прогресс по каждому классу</p>
          </div>
        </div>
        {data.classes.length === 0 ? (
          <Card><Empty icon={<School className="h-10 w-10" />} title="Классов пока нет"
            text={user!.role === 'admin' ? 'Создайте классы и назначьте учителей в разделе «Управление».' : 'Попросите администрацию назначить вам класс.'} /></Card>
        ) : (
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.classes.map((c: any, i: number) => (
              <Link key={c.id} to={`/classes/${c.id}`}
                className="panel-top block h-full rounded-[14px] border border-border/80 bg-white p-5 shadow-soft transition hover:-translate-y-0.5"
                style={{ borderTopColor: SERIES_COLORS[i % SERIES_COLORS.length] }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-serif text-2xl font-semibold text-ink">{c.name}</div>
                    <div className="text-xs text-muted">{c.year} · {c.students} учеников</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-mono text-2xl font-semibold ${pctText(c.percent)}`}>{fmtPct(c.percent)}</div>
                    <div className="text-[11px] uppercase tracking-wide text-muted">успеваемость</div>
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${pctFill(c.percent)}`} style={{ width: `${c.percent ?? 0}%` }} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted">Посещаемость <b className="font-mono text-ink">{fmtPct(c.attendance)}</b></span>
                  <span className="font-semibold text-brand-600">Открыть →</span>
                </div>
                {c.teachers.length > 0 && <div className="mt-2 truncate text-xs text-slate-400">{c.teachers.map((t: any) => t.name).join(', ')}</div>}
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-rose-600" />Требуют внимания</span>} subtitle="Низкая успеваемость, снижение или пропуски" />
          {data.atRisk.length === 0 ? (
            <div className="px-5 pb-5"><ChartEmpty>Учеников в зоне риска нет 👍</ChartEmpty></div>
          ) : (
            <ul className="divide-y divide-border/60 px-2 pb-2">
              {data.atRisk.map((s: any) => (
                <li key={s.id}>
                  <Link to={`/students/${s.id}`} className="flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-slate-50">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-ink">{s.full_name} <span className="text-xs font-normal text-muted">{s.class_name}</span></div>
                      <div className="text-xs text-muted">{s.riskReasons.join('; ')}</div>
                    </div>
                    <span className={`font-mono text-sm font-semibold ${pctText(s.percent)}`}>{fmtPct(s.percent)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2">🎯 Цели: ближайшие сроки</span>}
            subtitle={data.goalStats.total ? `В плане: ${data.goalStats.on_track || 0} · отстают: ${behind} · достигнуто: ${data.goalStats.achieved || 0}` : 'Ставьте ученикам цели — здесь появится их прогресс'} />
          {data.goalFocus.length === 0 ? (
            <div className="px-5 pb-5"><ChartEmpty>Активных целей пока нет</ChartEmpty></div>
          ) : (
            <ul className="divide-y divide-border/60 px-2 pb-2">
              {data.goalFocus.map((g: any) => (
                <li key={g.id}>
                  <Link to={`/students/${g.student_id}`} className="block rounded-xl px-3 py-3 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-ink">{g.title}</div>
                        <div className="text-xs text-muted">{g.full_name}{g.deadline ? ` · до ${fmtDate(g.deadline)}` : ''}</div>
                      </div>
                      <span className={`chip shrink-0 ${HEALTH[g.health].cls}`}>{HEALTH[g.health].label}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${g.progress ?? 0}%` }} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Успеваемость по предметам" subtitle="Средний процент по вашим классам" />
          <div className="p-5 pt-3">
            {data.subjects.length ? <PercentBars items={data.subjects.map((s: any) => ({ label: s.subject, value: s.percent, hint: `${s.count} оц.` }))} />
              : <ChartEmpty>Оценок пока нет</ChartEmpty>}
          </div>
        </Card>
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-600" />Новое в банке</span>} />
            {data.recentMaterials.length === 0 ? <div className="px-5 pb-5"><ChartEmpty>Материалов пока нет</ChartEmpty></div> : (
              <ul className="space-y-1 px-2 pb-3">
                {data.recentMaterials.map((m: any) => (
                  <li key={m.id}>
                    <Link to={`/students/${m.student_id}`} className="flex gap-3 rounded-xl px-3 py-2 hover:bg-slate-50">
                      <span className="text-lg">{CATEGORY_STYLE[m.category]?.emoji || '📎'}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-ink">{m.full_name} · <span className="font-normal text-muted">{m.category || 'материал'}</span></div>
                        <div className="line-clamp-2 text-xs text-muted">{m.ai_summary || (m.ai_status === 'pending' ? 'ИИ разбирает…' : m.original_name)}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Award className="h-4 w-4 text-amber-600" />Последние достижения</span>} />
            {data.recentAchievements.length === 0 ? <div className="px-5 pb-5"><ChartEmpty>Достижений пока нет</ChartEmpty></div> : (
              <ul className="space-y-1 px-2 pb-3">
                {data.recentAchievements.slice(0, 4).map((a: any) => (
                  <li key={a.id}>
                    <Link to={`/students/${a.student_id}`} className="block rounded-xl px-3 py-2 hover:bg-slate-50">
                      <div className="text-sm font-semibold text-ink">{a.title}</div>
                      <div className="text-xs text-muted">{a.full_name} · {a.result || 'участие'} · {a.level}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
