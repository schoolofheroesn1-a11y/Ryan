"use client";

import { useState } from "react";

/** Использует системное меню «Поделиться», если оно есть, иначе копирует ссылку. */
export function ShareButton({ title, path }: { title: string; path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={async () => {
        const url = new URL(path, window.location.origin).toString();
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
            return;
          } catch {
            /* пользователь закрыл меню — копируем ссылку */
          }
        }
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Скопируйте ссылку", url);
        }
      }}
    >
      <span aria-live="polite">{copied ? "Ссылка скопирована" : "Поделиться ссылкой"}</span>
    </button>
  );
}
