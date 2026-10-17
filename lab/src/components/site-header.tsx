import Link from "next/link";
import { ChevronDown, FlaskConical, Menu } from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { isStaff } from "@/server/permissions";
import { logoutAction } from "@/app/actions/auth";
import { HeaderSearch } from "./header-search";
import { NavLinks } from "./nav-links";
import { AutoCloseDetails } from "./auto-close-details";
import { Suspense } from "react";

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
      <div className="container-page flex h-[64px] items-center gap-4">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="Лаборатория педагогических технологий — на главную">
          <span aria-hidden className="grid h-9 w-9 place-items-center rounded-[10px] bg-accent text-white shadow-[0_2px_0_#1f1a8a] transition-transform group-hover:-rotate-6">
            <FlaskConical className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </span>
          <span className="leading-none">
            <span className="block font-display text-[14px] font-semibold tracking-tight">Лаборатория</span>
            <span className="mt-1 block text-[11px] text-muted">педагогических технологий</span>
          </span>
        </Link>
        <nav aria-label="Основная навигация" className="ml-2 hidden items-center gap-0.5 xl:flex">
          <NavLinks variant="desktop" />
        </nav>
        <div className="ml-auto hidden items-center gap-2 xl:flex">
          <HeaderSearch />
          <Link href="/submit" className="btn-secondary btn-sm whitespace-nowrap">
            Предложить материал
          </Link>
          {user ? (
            <AutoCloseDetails
              className="relative"
              summary={
                <summary className="btn-ghost btn-sm list-none" title={user.name}>
                  <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
                    {user.name.slice(0, 1).toUpperCase()}
                  </span>
                  Кабинет <ChevronDown aria-hidden className="h-3.5 w-3.5" />
                </summary>
              }
            >
              <div className="absolute right-0 top-11 w-56 rounded-xl border border-line bg-surface p-1.5 text-[14px] shadow-[var(--shadow-lift)]">
                <p className="truncate px-3 py-2 text-[12.5px] text-muted">{user.name}</p>
                <Link href="/me" className="block rounded-lg px-3 py-2 hover:bg-accent-soft hover:text-accent">Личный кабинет</Link>
                <Link href="/me?tab=publications" className="block rounded-lg px-3 py-2 hover:bg-accent-soft hover:text-accent">Мои публикации</Link>
                {isStaff(user) && <Link href="/admin" className="block rounded-lg px-3 py-2 hover:bg-accent-soft hover:text-accent">Редакция</Link>}
                <form action={logoutAction}>
                  <button className="w-full rounded-lg px-3 py-2 text-left text-danger hover:bg-danger-soft" type="submit">Выйти</button>
                </form>
              </div>
            </AutoCloseDetails>
          ) : (
            <Link href="/login" className="btn-primary btn-sm">
              Войти
            </Link>
          )}
        </div>
        <Suspense>
        <AutoCloseDetails
          className="relative ml-auto xl:hidden"
          summary={
            <summary className="btn-secondary btn-sm list-none" aria-label="Открыть меню">
              <Menu aria-hidden className="h-4 w-4" /> Меню
            </summary>
          }
        >
          <div className="absolute right-0 top-12 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow-lift)]">
            <form action="/library" method="get" role="search" className="p-1 pb-2">
              <label htmlFor="mobile-q" className="sr-only">Поиск</label>
              <input id="mobile-q" type="search" name="q" placeholder="Найти решение…" className="input h-10 text-[14px]" />
            </form>
            <nav aria-label="Мобильная навигация" className="flex flex-col">
              <NavLinks variant="mobile" />
              <hr className="my-2 border-line" />
              <Link href="/submit" className="rounded-lg px-3 py-2.5 hover:bg-neutral-soft">
                Предложить материал
              </Link>
              {user ? (
                <>
                  {isStaff(user) && (
                    <Link href="/admin" className="rounded-lg px-3 py-2.5 hover:bg-neutral-soft">
                      Редакция
                    </Link>
                  )}
                  <Link href="/me" className="rounded-lg px-3 py-2.5 hover:bg-neutral-soft">
                    Личный кабинет
                  </Link>
                  <form action={logoutAction}>
                    <button className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-neutral-soft" type="submit">
                      Выйти
                    </button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="rounded-lg px-3 py-2.5 font-medium text-accent hover:bg-neutral-soft">
                  Войти или зарегистрироваться
                </Link>
              )}
            </nav>
          </div>
        </AutoCloseDetails>
        </Suspense>
      </div>
    </header>
  );
}
