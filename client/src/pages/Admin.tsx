import React, { useEffect, useState } from 'react';
import { BookOpen, Pencil, Plus, School, Trash2, UserPlus, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../App';
import { Badge, Button, Card, CardHeader, Empty, ErrorText, Field, Modal, Spinner, Tabs, confirmDelete } from '../components/ui';

type Tab = 'users' | 'classes' | 'subjects';

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<any[] | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  const load = async () => {
    const [u, c, s] = await Promise.all([api.get('/api/users'), api.get('/api/classes'), api.get('/api/subjects')]);
    setUsers(u);
    setClasses(c);
    setSubjects(s);
    window.dispatchEvent(new Event('classes:changed'));
  };
  useEffect(() => { load(); }, []);

  if (!users) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Управление школой</h1>
        <p className="text-sm text-slate-500">Учителя, классы и предметы</p>
      </div>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: 'users', label: 'Сотрудники', count: users.length },
        { id: 'classes', label: 'Классы', count: classes.length },
        { id: 'subjects', label: 'Предметы', count: subjects.length },
      ]} />
      {tab === 'users' && <UsersTab users={users} classes={classes} reload={load} />}
      {tab === 'classes' && <ClassesTab classes={classes} reload={load} />}
      {tab === 'subjects' && <SubjectsTab subjects={subjects} reload={load} />}
    </div>
  );
}

function UsersTab({ users, classes, reload }: { users: any[]; classes: any[]; reload: () => void }) {
  const { user: me } = useApp();
  const [edit, setEdit] = useState<any | null>(null);
  const del = async (u: any) => {
    if (!confirmDelete(`сотрудника «${u.name}»`)) return;
    await api.del(`/api/users/${u.id}`);
    reload();
  };
  const className = (id: number) => classes.find((c) => c.id === id)?.name;

  return (
    <Card>
      <CardHeader title="Сотрудники" subtitle="Учителя видят только назначенные им классы; администрация — всю школу"
        action={<Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setEdit({})}>Добавить</Button>} />
      <ul className="divide-y divide-slate-100">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{u.name} {u.id === me!.id && <span className="text-xs text-slate-400">(вы)</span>}</div>
              <div className="text-xs text-slate-500">{u.email}</div>
            </div>
            <div className="flex flex-wrap gap-1">
              {u.role === 'admin' ? <Badge className="bg-violet-100 text-violet-700">Администрация</Badge>
                : u.classIds.length ? u.classIds.map((id: number) => <Badge key={id} className="bg-indigo-50 text-indigo-700">{className(id)}</Badge>)
                : <Badge className="bg-slate-100 text-slate-500">Нет классов</Badge>}
            </div>
            <Button variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setEdit(u)} title="Изменить" />
            {u.id !== me!.id && <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => del(u)} title="Удалить" />}
          </li>
        ))}
      </ul>
      {edit && <UserModal user={edit} classes={classes} isSelf={edit.id === me!.id} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}
    </Card>
  );
}

function UserModal({ user, classes, isSelf, onClose, onDone }: { user: any; classes: any[]; isSelf: boolean; onClose: () => void; onDone: () => void }) {
  const isNew = !user.id;
  const [form, setForm] = useState({ name: user.name || '', email: user.email || '', password: '', role: user.role || 'teacher' });
  const [classIds, setClassIds] = useState<number[]>(user.classIds || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<any>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isNew) await api.post('/api/users', { ...form, classIds });
      else await api.patch(`/api/users/${user.id}`, { ...form, classIds });
      onDone();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={isNew ? 'Новый сотрудник' : 'Изменить сотрудника'}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="ФИО"><input className="input" value={form.name} onChange={set('name')} required autoFocus /></Field>
        <Field label="Email (логин)"><input className="input" type="email" value={form.email} onChange={set('email')} required /></Field>
        <Field label={isNew ? 'Пароль (не меньше 6 символов)' : 'Новый пароль (оставьте пустым, чтобы не менять)'}>
          <input className="input" type="text" value={form.password} onChange={set('password')} required={isNew} minLength={6} />
        </Field>
        {!isSelf && (
          <Field label="Роль">
            <select className="input" value={form.role} onChange={set('role')}>
              <option value="teacher">Учитель</option>
              <option value="admin">Администрация (полный доступ)</option>
            </select>
          </Field>
        )}
        {form.role === 'teacher' && (
          <div>
            <span className="label">Классы, к которым есть доступ</span>
            {classes.length === 0 ? <p className="text-sm text-slate-400">Сначала создайте классы</p> : (
              <div className="flex flex-wrap gap-2">
                {classes.map((c) => {
                  const on = classIds.includes(c.id);
                  return (
                    <button type="button" key={c.id} onClick={() => setClassIds(on ? classIds.filter((x) => x !== c.id) : [...classIds, c.id])}
                      className={`rounded-lg border px-3 py-1.5 text-sm ${on ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <ErrorText error={error} />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit" loading={loading}>Сохранить</Button>
        </div>
      </form>
    </Modal>
  );
}

function ClassesTab({ classes, reload }: { classes: any[]; reload: () => void }) {
  const [edit, setEdit] = useState<any | null>(null);
  const del = async (c: any) => {
    if (!confirmDelete(`класс «${c.name}»? Ученики останутся в базе без класса, но станут недоступны учителям`)) return;
    await api.del(`/api/classes/${c.id}`);
    reload();
  };
  return (
    <Card>
      <CardHeader title="Классы" action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({})}>Создать класс</Button>} />
      {classes.length === 0 ? <Empty icon={<School className="h-10 w-10" />} title="Классов пока нет" text="Создайте классы, затем назначьте учителей во вкладке «Сотрудники»." /> : (
        <ul className="divide-y divide-slate-100">
          {classes.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{c.name} <span className="text-xs font-normal text-slate-400">{c.year}</span></div>
                <div className="text-xs text-slate-500"><Users className="mr-1 inline h-3 w-3" />{c.students} учеников · {c.teachers.map((t: any) => t.name).join(', ') || 'учителя не назначены'}</div>
              </div>
              <Button variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setEdit(c)} title="Изменить" />
              <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => del(c)} title="Удалить" />
            </li>
          ))}
        </ul>
      )}
      {edit && <ClassModal cls={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}
    </Card>
  );
}

function ClassModal({ cls, onClose, onDone }: { cls: any; onClose: () => void; onDone: () => void }) {
  const y = new Date().getFullYear();
  const defYear = new Date().getMonth() >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
  const [name, setName] = useState(cls.name || '');
  const [year, setYear] = useState(cls.year ?? defYear);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (cls.id) await api.patch(`/api/classes/${cls.id}`, { name, year });
      else await api.post('/api/classes', { name, year });
      onDone();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={cls.id ? 'Изменить класс' : 'Новый класс'}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Название"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="7А" /></Field>
          <Field label="Учебный год"><input className="input" value={year} onChange={(e) => setYear(e.target.value)} /></Field>
        </div>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit" loading={loading}>Сохранить</Button>
        </div>
      </form>
    </Modal>
  );
}

function SubjectsTab({ subjects, reload }: { subjects: any[]; reload: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/api/subjects', { name });
      setName('');
      reload();
    } catch (err: any) {
      setError(err.message);
    }
  };
  const del = async (s: any) => {
    if (!confirmDelete(`предмет «${s.name}» вместе со всеми оценками по нему`)) return;
    await api.del(`/api/subjects/${s.id}`);
    reload();
  };
  return (
    <Card>
      <CardHeader title="Предметы" />
      <form onSubmit={add} className="flex gap-2 border-b border-slate-100 p-4">
        <input className="input max-w-xs" value={name} onChange={(e) => setName(e.target.value)} placeholder="Новый предмет" required />
        <Button type="submit" icon={<Plus className="h-4 w-4" />}>Добавить</Button>
      </form>
      {error && <div className="p-4 pb-0"><ErrorText error={error} /></div>}
      <div className="flex flex-wrap gap-2 p-4">
        {subjects.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 py-1 pl-3 pr-1 text-sm">
            <BookOpen className="h-3.5 w-3.5 text-slate-400" />{s.name}
            <button onClick={() => del(s)} className="rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600" title="Удалить"><Trash2 className="h-3.5 w-3.5" /></button>
          </span>
        ))}
      </div>
    </Card>
  );
}
