"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * GET-форма фильтров. Без JavaScript работает через кнопку «Применить»;
 * с JavaScript применяет фильтры сразу при изменении.
 */
export function FilterForm({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  const router = useRouter();
  return (
    <form
      id={id}
      method="get"
      className={className}
      onChange={(e) => {
        const target = e.target as HTMLElement;
        if (target instanceof HTMLInputElement && target.type === "search") return;
        const form = e.currentTarget;
        const params = new URLSearchParams();
        for (const [k, v] of new FormData(form)) if (typeof v === "string" && v !== "") params.append(k, v);
        router.replace(`${form.getAttribute("action") ?? ""}?${params.toString()}`, { scroll: false });
      }}
    >
      {children}
    </form>
  );
}
