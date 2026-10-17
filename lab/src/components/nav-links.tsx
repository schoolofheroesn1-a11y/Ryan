"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/library", label: "Библиотека" },
  { href: "/practice", label: "Фишки и кейсы" },
  { href: "/research", label: "Испытания" },
  { href: "/methodology", label: "Методика" },
];

export function NavLinks({ variant }: { variant: "desktop" | "mobile" }) {
  const pathname = usePathname();
  return (
    <>
      {nav.map((n) => {
        const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
        return variant === "desktop" ? (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap px-3 py-2.5 font-mono text-[12.5px] font-bold uppercase tracking-[0.08em] text-ink transition-colors ${
              active ? "underline decoration-[3px] underline-offset-[6px]" : "hover:bg-ink hover:text-marker"
            }`}
          >
            {n.label}
          </Link>
        ) : (
          <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={`px-3 py-2.5 font-mono text-[13px] font-bold uppercase tracking-[0.06em] ${active ? "bg-marker" : "hover:bg-marker"}`}>
            {n.label}
          </Link>
        );
      })}
    </>
  );
}
