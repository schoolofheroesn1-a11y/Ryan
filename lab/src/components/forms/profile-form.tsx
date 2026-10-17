"use client";

import { useActionState } from "react";
import { changePasswordAction, updateProfileAction } from "@/app/actions/profile";
import { initialActionState } from "@/lib/action-state";
import { FormMessage } from "../ui/form-message";
import { SubmitButton } from "../ui/submit-button";
import { TextArea, TextField } from "./field";

export function ProfileForm({ initial }: { initial: { name: string; specialization: string; bio: string; links: string } }) {
  const [state, action] = useActionState(updateProfileAction, initialActionState);
  const v = { ...initial, ...(state.values as Record<string, string> | undefined) };
  const e = state.errors ?? {};
  return (
    <form action={action} className="flex max-w-2xl flex-col gap-4" noValidate>
      <FormMessage ok={state.ok} message={state.message} />
      <TextField label="Имя или псевдоним" name="name" required defaultValue={v.name} error={e.name} />
      <TextField label="Специализация" name="specialization" defaultValue={v.specialization} error={e.specialization} hint="Например: учитель биологии, 5–9 классы. Указывайте только то, что готовы подтвердить." />
      <TextArea label="О себе" name="bio" rows={4} defaultValue={v.bio} error={e.bio} />
      <TextArea label="Ссылки на профессиональные ресурсы" name="links" rows={3} defaultValue={v.links} error={e.links} hint="По одной ссылке в строке, до 5. Необязательно." />
      <div><SubmitButton>Сохранить профиль</SubmitButton></div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initialActionState);
  const e = state.errors ?? {};
  return (
    <form action={action} className="flex max-w-2xl flex-col gap-4" noValidate>
      <h2 className="text-lg font-semibold">Смена пароля</h2>
      <FormMessage ok={state.ok} message={state.message} />
      <TextField label="Текущий пароль" name="current" type="password" autoComplete="current-password" required error={e.current} />
      <TextField label="Новый пароль" name="next" type="password" autoComplete="new-password" required minLength={8} error={e.next} hint="Не короче 8 символов. После смены все другие сеансы будут завершены." />
      <div><SubmitButton className="btn-secondary">Сменить пароль</SubmitButton></div>
    </form>
  );
}
