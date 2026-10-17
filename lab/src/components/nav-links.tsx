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
            className={`relative whitespace-nowrap rounded-lg px-3 py-2 text-[14.5px] transition-colors ${
              active ? "font-medium text-ink after:absolute after:inset-x-3 after:-bottom-[13px] after:h-[3px] after:rounded-full after:bg-accent" : "text-ink-soft hover:bg-accent-soft hover:text-accent"
            }`}
          >
            {n.label}
          </Link>
        ) : (
          <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={`rounded-lg px-3 py-2.5 ${active ? "bg-accent-soft font-medium text-accent" : "hover:bg-neutral-soft"}`}>
            {n.label}
          </Link>
        );
      })}
    </>
  );
}
