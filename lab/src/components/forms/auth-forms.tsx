"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, registerAction } from "@/app/actions/auth";
import { initialActionState } from "@/lib/action-state";
import { FormMessage } from "../ui/form-message";
import { SubmitButton } from "../ui/submit-button";
import { TextField } from "./field";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormMessage ok={state.ok} message={state.message} />
      <TextField label="Электронная почта" name="email" type="email" autoComplete="email" required defaultValue={String(state.values?.email ?? "")} error={state.errors?.email} />
      <TextField label="Пароль" name="password" type="password" autoComplete="current-password" required error={state.errors?.password} />
      <SubmitButton pendingText="Входим…">Войти</SubmitButton>
      <p className="text-sm text-muted">
        Нет аккаунта? <Link href={`/register?next=${encodeURIComponent(next)}`} className="link">Зарегистрироваться</Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action] = useActionState(registerAction, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormMessage ok={state.ok} message={state.message} />
      <TextField label="Имя или псевдоним" name="name" autoComplete="name" required defaultValue={String(state.values?.name ?? "")} error={state.errors?.name} hint="Будет показано в профиле и у ваших публикаций." />
      <TextField label="Электронная почта" name="email" type="email" autoComplete="email" required defaultValue={String(state.values?.email ?? "")} error={state.errors?.email} />
      <TextField label="Пароль" name="password" type="password" autoComplete="new-password" required minLength={8} error={state.errors?.password} hint="Не короче 8 символов." />
      <SubmitButton pendingText="Создаём аккаунт…">Зарегистрироваться</SubmitButton>
      <p className="text-sm text-muted">
        Уже есть аккаунт? <Link href={`/login?next=${encodeURIComponent(next)}`} className="link">Войти</Link>
      </p>
    </form>
  );
}
