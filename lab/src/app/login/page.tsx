import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms/auth-forms";
import { safeNext } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/server/auth";

export const metadata: Metadata = { title: "Вход", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getCurrentUser()) redirect(next);
  return (
    <div className="container-page flex justify-center py-12 sm:py-16">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="font-serif text-2xl font-semibold">Вход</h1>
        <p className="mb-6 mt-1 text-sm text-muted">Чтобы сохранять материалы в избранное, публиковать и оставлять отзывы.</p>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
