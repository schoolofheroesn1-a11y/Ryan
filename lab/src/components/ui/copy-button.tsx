"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Копировать", className = "btn-secondary btn-sm" }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("done");
        } catch {
          setState("error");
        }
        setTimeout(() => setState("idle"), 2000);
      }}
    >
      <span aria-live="polite">{state === "done" ? "Скопировано" : state === "error" ? "Не удалось скопировать" : label}</span>
    </button>
  );
}
