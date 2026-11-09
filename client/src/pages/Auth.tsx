import React, { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../App';
import { Button, ErrorText, Field } from '../components/ui';

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
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
    <Shell title="Портфолио учеников" subtitle="Вход для учителей и администрации">
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
