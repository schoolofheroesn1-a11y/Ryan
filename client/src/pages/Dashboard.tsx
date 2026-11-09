import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Award, GraduationCap, School, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../App';
import { Badge, Card, CardHeader, Empty, Spinner, Stat } from '../components/ui';
import { fmtDate, gradeColor } from '../lib/format';

export function DashboardPage() {
  const { user } = useApp();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get('/api/dashboard').then(setData);
  }, []);

  if (!data) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Здравствуйте, {user!.name}!</h1>
        <p className="text-sm text-slate-500">Обзор ваших классов и учеников, которым сейчас нужно внимание.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Классов" value={data.totals.classes} icon={<School className="h-5 w-5" />} />
        <Stat label="Учеников" value={data.totals.students} icon={<Users className="h-5 w-5" />} />
        <Stat label="Нужна поддержка" value={data.atRisk.length} valueCls={data.atRisk.length ? 'text-rose-600' : ''} icon={<AlertTriangle className="h-5 w-5" />} />
        {data.totals.teachers !== null
          ? <Stat label="Учителей" value={data.totals.teachers} icon={<GraduationCap className="h-5 w-5" />} />
          : <Stat label="Достижений недавно" value={data.recentAchievements.length} icon={<Award className="h-5 w-5" />} />}
      </div>

      <Card>
        <CardHeader title="Классы" />
        {data.classes.length === 0 ? (
          <Empty icon={<School className="h-10 w-10" />} title="Классов пока нет"
            text={user!.role === 'admin' ? 'Создайте классы и назначьте учителей в разделе «Управление».' : 'Попросите администрацию назначить вам класс.'} />
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.classes.map((c: any) => (
              <Link key={c.id} to={`/classes/${c.id}`} className="rounded-lg border border-slate-200 p-4 transition hover:border-indigo-300 hover:shadow-sm">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-semibold">{c.name}</span>
                  <span className="text-xs text-slate-400">{c.year}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs text-slate-500">
                  <div><div className="text-base font-semibold text-slate-800">{c.students}</div>учеников</div>
                  <div><div className={`text-base font-semibold ${gradeColor(c.average)}`}>{c.average ?? '—'}</div>ср. балл</div>
                  <div><div className="text-base font-semibold text-slate-800">{c.attendance != null ? `${c.attendance}%` : '—'}</div>посещ.</div>
                </div>
                {c.teachers.length > 0 && <div className="mt-2 truncate text-xs text-slate-400">{c.teachers.map((t: any) => t.name).join(', ')}</div>}
              </Link>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Нужна поддержка" subtitle="Низкий балл, падение оценок или пропуски" />
          {data.atRisk.length === 0 ? (
            <Empty title="Нет учеников в зоне риска" text="Отлично! Продолжайте следить за динамикой." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.atRisk.map((s: any) => (
                <li key={s.id}>
                  <Link to={`/students/${s.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{s.full_name} <span className="text-xs font-normal text-slate-400">{s.class_name}</span></div>
                      <div className="text-xs text-slate-500">{s.riskReasons.join('; ')}</div>
                    </div>
                    <span className={`text-sm font-semibold ${gradeColor(s.average)}`}>{s.average ?? '—'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Последние достижения" />
          {data.recentAchievements.length === 0 ? (
            <Empty title="Достижений пока нет" text="Добавляйте олимпиады, конкурсы и проекты в портфолио учеников." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentAchievements.map((a: any) => (
                <li key={a.id}>
                  <Link to={`/students/${a.student_id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50">
                    <Award className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{a.title}</div>
                      <div className="text-xs text-slate-500">{a.full_name} · {a.result || 'участие'} · {fmtDate(a.date)}</div>
                    </div>
                    <Badge className="bg-slate-100 text-slate-600">{a.level}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
