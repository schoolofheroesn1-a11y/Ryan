import Link from "next/link";
import { getCurrentUser } from "@/server/auth";
import { isStaff } from "@/server/permissions";
import { logoutAction } from "@/app/actions/auth";

const nav = [
  { href: "/library", label: "Библиотека" },
  { href: "/research", label: "Испытания" },
  { href: "/practice", label: "Фишки и кейсы" },
  { href: "/methodology", label: "Методика" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur-sm">
      <div className="container-page flex h-16 items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-ink font-serif text-[15px] text-paper">
            Л
          </span>
          <span className="leading-tight">
            <span className="block text-[15px]">Лаборатория</span>
            <span className="block text-[11px] font-normal text-muted">педагогических технологий</span>
          </span>
        </Link>
        <nav aria-label="Основная навигация" className="hidden flex-1 items-center gap-1 md:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 text-[15px] text-ink-soft hover:bg-neutral-soft hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Link href="/submit" className="btn-secondary btn-sm">
            Предложить материал
          </Link>
          {user ? (
            <>
              {isStaff(user) && (
                <Link href="/admin" className="btn-ghost btn-sm">
                  Редакция
                </Link>
              )}
              <Link href="/me" className="btn-ghost btn-sm">
                Кабинет
              </Link>
              <form action={logoutAction}>
                <button className="btn-ghost btn-sm" type="submit">
                  Выйти
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn-primary btn-sm">
              Войти
            </Link>
          )}
        </div>
        <details className="relative ml-auto md:hidden">
          <summary className="btn-secondary btn-sm list-none" aria-label="Открыть меню">
            Меню
          </summary>
          <div className="absolute right-0 top-11 w-64 rounded-xl border border-line bg-surface p-2 shadow-lg">
            <nav aria-label="Мобильная навигация" className="flex flex-col">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-md px-3 py-2.5 hover:bg-neutral-soft">
                  {n.label}
                </Link>
              ))}
              <hr className="my-2 border-line" />
              <Link href="/submit" className="rounded-md px-3 py-2.5 hover:bg-neutral-soft">
                Предложить материал
              </Link>
              {user ? (
                <>
                  {isStaff(user) && (
                    <Link href="/admin" className="rounded-md px-3 py-2.5 hover:bg-neutral-soft">
                      Редакция
                    </Link>
                  )}
                  <Link href="/me" className="rounded-md px-3 py-2.5 hover:bg-neutral-soft">
                    Личный кабинет
                  </Link>
                  <form action={logoutAction}>
                    <button className="w-full rounded-md px-3 py-2.5 text-left hover:bg-neutral-soft" type="submit">
                      Выйти
                    </button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="rounded-md px-3 py-2.5 font-medium text-accent hover:bg-neutral-soft">
                  Войти или зарегистрироваться
                </Link>
              )}
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
