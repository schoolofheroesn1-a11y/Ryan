import React, { useState } from 'react';
import { api } from '../lib/api';
import { useApp } from '../App';
import { Button, Card, CardHeader, ErrorText, Field } from '../components/ui';

export function ProfilePage() {
  const { user } = useApp();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      await api.post('/api/me/password', { current, next });
      setMsg('Пароль изменён');
      setCurrent('');
      setNext('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">Профиль</h1>
      <Card className="p-5 text-sm">
        <div className="text-lg font-medium">{user!.name}</div>
        <div className="text-slate-500">{user!.email}</div>
        <div className="mt-1 text-slate-500">{user!.role === 'admin' ? 'Администрация' : 'Учитель'}</div>
      </Card>
      <Card>
        <CardHeader title="Сменить пароль" />
        <form onSubmit={submit} className="space-y-4 p-5">
          <Field label="Текущий пароль"><input className="input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></Field>
          <Field label="Новый пароль"><input className="input" type="password" minLength={6} value={next} onChange={(e) => setNext(e.target.value)} required /></Field>
          <ErrorText error={error} />
          {msg && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
          <Button type="submit" loading={loading}>Сохранить</Button>
        </form>
      </Card>
    </div>
  );
}
