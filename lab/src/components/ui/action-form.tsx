"use client";

import { useActionState, type ReactNode } from "react";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { FormMessage } from "./form-message";

/** Небольшая форма с серверным действием и выводом результата. */
export function ActionForm({
  action,
  children,
  className,
  successMessage,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  successMessage?: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className={className}>
      {children}
      {state.message ? (
        <div className="mt-2 basis-full">
          <FormMessage ok={state.ok} message={state.message} />
        </div>
      ) : state.ok && successMessage ? (
        <div className="mt-2 basis-full">
          <FormMessage ok message={successMessage} />
        </div>
      ) : null}
    </form>
  );
}
