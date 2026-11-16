import React, { useState } from 'react';
import { Copy, KeyRound } from 'lucide-react';
import { api } from '../../lib/api';
import { Button, ErrorText, Modal } from '../../components/ui';
import { fmtDate } from '../../lib/format';

/** Issue / reset / revoke the student's access to their own cabinet. */
export function StudentAccessModal({ data, onClose, onDone }: { data: any; onClose: () => void; onDone: () => void }) {
  const [creds, setCreds] = useState<{ login: string; password: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const acc = data.account;

  const issue = async () => {
    setLoading(true);
    setError(null);
    try {
      setCreds(await api.post(`/api/students/${data.student.id}/account`));
      onDone();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  const revoke = async () => {
    if (!window.confirm('Отключить ученику вход в личный кабинет?')) return;
    await api.del(`/api/students/${data.student.id}/account`);
    setCreds(null);
    onDone();
  };
  const text = creds ? `Сайт: ${window.location.origin}\nЛогин: ${creds.login}\nПароль: ${creds.password}` : '';

  return (
    <Modal open onClose={onClose} title="Личный кабинет ученика">
      <div className="space-y-4 text-sm">
        <p className="text-slate-600">
          В кабинете ученик видит свои предметы, цели и пробники, пишет еженедельную рефлексию, оценивает себя и ставит свои цели.
          Заметки учителей, банк материалов и советы ИИ ему <b>не видны</b>.
        </p>
        {acc && !creds && (
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div>Логин: <b className="font-mono">{acc.login}</b></div>
            <div className="text-xs text-muted">выдан {fmtDate(acc.created_at)} · {acc.last_login ? `последний вход ${fmtDate(acc.last_login)}` : 'ещё не входил'}</div>
          </div>
        )}
        {creds && (
          <div className="rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 px-4 py-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-700">Передайте ученику — пароль показывается один раз</div>
            <div className="font-mono text-base">Логин: <b>{creds.login}</b></div>
            <div className="font-mono text-base">Пароль: <b>{creds.password}</b></div>
            <Button variant="secondary" className="mt-2 px-3 py-1.5 text-xs" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => navigator.clipboard.writeText(text)}>Скопировать</Button>
          </div>
        )}
        <p className="text-xs text-muted">Перед выдачей доступа убедитесь, что от родителей есть согласие на обработку персональных данных ребёнка.</p>
        <ErrorText error={error} />
        <div className="flex flex-wrap justify-end gap-2">
          {acc && <Button variant="ghost" onClick={revoke}>Отключить доступ</Button>}
          <Button icon={<KeyRound className="h-4 w-4" />} loading={loading} onClick={issue}>{acc ? 'Сбросить пароль' : 'Выдать доступ'}</Button>
        </div>
      </div>
    </Modal>
  );
}
