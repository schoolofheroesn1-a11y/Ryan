import Link from "next/link";

export const metadata = { title: "Нет доступа", robots: { index: false } };

export default function ForbiddenPage() {
  return (
    <div className="container-page py-20">
      <h1 className="font-serif text-3xl font-semibold">Нет доступа</h1>
      <p className="mt-3 max-w-xl text-ink-soft">У вашего аккаунта недостаточно прав для этого раздела.</p>
      <Link href="/" className="btn-secondary mt-6">На главную</Link>
    </div>
  );
}
