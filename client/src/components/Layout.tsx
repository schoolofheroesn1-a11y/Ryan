import React, { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { GraduationCap, LayoutDashboard, LogOut, Menu, Settings, Sparkles, UserCircle, Users, X } from 'lucide-react';
import { useApp } from '../App';
import { api } from '../lib/api';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, ai, logout } = useApp();
  const [classes, setClasses] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.get('/api/classes').then(setClasses).catch(() => {});
    const h = () => api.get('/api/classes').then(setClasses).catch(() => {});
    window.addEventListener('classes:changed', h);
    return () => window.removeEventListener('classes:changed', h);
  }, []);

  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  const nav = (
    <nav className="flex h-full flex-col gap-1 p-3" onClick={() => setOpen(false)}>
      <NavLink to="/" end className={link}><LayoutDashboard className="h-4 w-4" />Главная</NavLink>
      <div className="mt-4 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Классы</div>
      {classes.length === 0 && <p className="px-3 text-sm text-slate-400">{user!.role === 'admin' ? 'Создайте класс в разделе «Управление»' : 'Вам пока не назначены классы'}</p>}
      {classes.map((c) => (
        <NavLink key={c.id} to={`/classes/${c.id}`} className={link}>
          <Users className="h-4 w-4" />
          <span className="flex-1">{c.name}</span>
          <span className="text-xs text-slate-400">{c.students}</span>
        </NavLink>
      ))}
      <div className="mt-auto space-y-1 border-t border-slate-100 pt-3">
        {user!.role === 'admin' && <NavLink to="/admin" className={link}><Settings className="h-4 w-4" />Управление</NavLink>}
        <NavLink to="/profile" className={link}><UserCircle className="h-4 w-4" />Профиль</NavLink>
        <div className={`mx-1 mt-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${ai.enabled ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>
          <Sparkles className="h-3.5 w-3.5" />
          {ai.enabled ? `ИИ: ${ai.model}` : 'ИИ: режим без ключа'}
        </div>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <Link to="/" className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white"><GraduationCap className="h-5 w-5" /></div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Портфолио</div>
            <div className="text-xs text-slate-500">учеников с ИИ</div>
          </div>
        </Link>
        <div className="flex-1 overflow-y-auto">{nav}</div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-64 bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="font-semibold">Меню</span>
              <button onClick={() => setOpen(false)} aria-label="Закрыть меню"><X className="h-5 w-5" /></button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <button className="rounded-md p-1.5 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Открыть меню">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <div className="text-right text-sm leading-tight">
            <div className="font-medium">{user!.name}</div>
            <div className="text-xs text-slate-500">{user!.role === 'admin' ? 'Администрация' : 'Учитель'}</div>
          </div>
          <button onClick={logout} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="Выйти">
            <LogOut className="h-4 w-4" />
          </button>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
