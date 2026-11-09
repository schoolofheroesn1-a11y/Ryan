import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './lib/api';
import { Spinner } from './components/ui';
import { Layout } from './components/Layout';
import { LoginPage, SetupPage } from './pages/Auth';
import { DashboardPage } from './pages/Dashboard';
import { ClassPage } from './pages/ClassPage';
import { StudentPage } from './pages/StudentPage';
import { AdminPage } from './pages/Admin';
import { ProfilePage } from './pages/Profile';

export interface User { id: number; name: string; email: string; role: 'admin' | 'teacher' }
interface AppState {
  user: User | null;
  ai: { enabled: boolean; model: string | null };
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}
const Ctx = createContext<AppState>(null!);
export const useApp = () => useContext(Ctx);

export default function App() {
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [ai, setAi] = useState<AppState['ai']>({ enabled: false, model: null });

  const refresh = useCallback(async () => {
    const [status, me] = await Promise.all([api.get('/api/setup-status'), api.get('/api/me')]);
    setNeedsSetup(status.needsSetup);
    setAi({ enabled: status.aiEnabled, model: status.aiModel });
    setUser(me.user);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh().catch(() => setLoading(false));
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [refresh]);

  const logout = async () => {
    await api.post('/api/logout');
    setUser(null);
  };

  if (loading) return <Spinner className="h-screen" />;
  if (needsSetup) return <Ctx.Provider value={{ user, ai, refresh, logout }}><SetupPage /></Ctx.Provider>;
  if (!user) return <Ctx.Provider value={{ user, ai, refresh, logout }}><LoginPage /></Ctx.Provider>;

  return (
    <Ctx.Provider value={{ user, ai, refresh, logout }}>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/classes/:id" element={<ClassPage />} />
          <Route path="/students/:id" element={<StudentPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          {user.role === 'admin' && <Route path="/admin" element={<AdminPage />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Ctx.Provider>
  );
}
