import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/forms/auth-forms";
import { safeNext } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/server/auth";

export const metadata: Metadata = { title: "Регистрация", robots: { index: false } };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getCurrentUser()) redirect(next);
  return (
    <div className="container-page flex justify-center py-12 sm:py-16">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="font-display text-2xl font-semibold">Присоединиться к сообществу</h1>
        <p className="mb-6 mt-1 text-sm text-muted">
          Регистрация бесплатна. Ваши публикации появятся в библиотеке после проверки редакцией.
        </p>
        <RegisterForm next={next} />
      </div>
    </div>
  );
}
