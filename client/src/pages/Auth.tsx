import React, { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../App';
import { Button, ErrorText, Field } from '../components/ui';

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden border-r border-border bg-slate-100 p-12 text-ink lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-100 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-amber-100 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-soft"><GraduationCap className="h-6 w-6" /></div>
          <span className="font-serif text-lg font-semibold">Портфолио учеников</span>
        </div>
        <div className="relative">
          <div className="text-xs uppercase tracking-wider text-muted">Школьная платформа развития</div>
          <h2 className="mt-3 max-w-md text-[40px] leading-tight">Каждый ученик — в росте, спокойно и по плану</h2>
          <p className="mt-4 max-w-md text-slate-600">
            Успеваемость по предметам в процентах, банк материалов, цели и путь к ним, аналитика класса и советы ИИ для учителя.
          </p>
          <div className="mt-10 grid max-w-md grid-cols-3 gap-3">
            {[
              { e: '📈', t: 'Успеваемость в процентах' },
              { e: '🎯', t: 'Цели и путь к ним' },
              { e: '✨', t: 'Советы ИИ по развитию' },
            ].map((f) => (
              <div key={f.t} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-3 shadow-soft">
                <span className="text-2xl">{f.e}</span>
                <span className="text-center text-[11px] leading-tight text-slate-700">{f.t}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative font-mono text-xs text-muted">оценки · цели · банк ученика · аналитика</div>
      </div>
      <div className="flex items-center justify-center px-4 py-10">
        <div className="page-in w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white"><GraduationCap className="h-6 w-6" /></div>
            <span className="font-serif text-lg font-semibold">Портфолио учеников</span>
          </div>
          <h1 className="text-3xl text-ink">{title}</h1>
          <p className="mb-6 mt-1 text-muted">{subtitle}</p>
          <div className="rounded-[14px] border border-border/80 bg-white p-6 shadow-soft sm:p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { refresh } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/login', { email, password });
      await refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <Shell title="Вход" subtitle="Для учителей и администрации школы">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></Field>
        <Field label="Пароль"><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        <ErrorText error={error} />
        <Button type="submit" loading={loading} className="w-full">Войти</Button>
        <p className="text-center text-xs text-slate-400">Нет доступа? Обратитесь к администрации школы.</p>
      </form>
    </Shell>
  );
}

export function SetupPage() {
  const { refresh } = useApp();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/setup', form);
      await refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <Shell title="Первый запуск" subtitle="Создайте учётную запись администратора школы">
      <form onSubmit={submit} className="space-y-4">
        <Field label="ФИО"><input className="input" value={form.name} onChange={set('name')} required autoFocus /></Field>
        <Field label="Email"><input className="input" type="email" value={form.email} onChange={set('email')} required /></Field>
        <Field label="Пароль (не меньше 6 символов)"><input className="input" type="password" minLength={6} value={form.password} onChange={set('password')} required /></Field>
        <ErrorText error={error} />
        <Button type="submit" loading={loading} className="w-full">Создать и войти</Button>
      </form>
    </Shell>
  );
}
