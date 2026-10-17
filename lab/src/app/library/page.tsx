import type { Metadata } from "next";
import { LibraryView } from "@/components/library-view";
import { PageHeader } from "@/components/ui/page-header";
import { parseLibraryFilters } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Библиотека решений",
  description: "Каталог педагогических решений: кейсы, фишки, обзоры инструментов, методики и шаблоны с фильтрами по задаче, классу, времени подготовки и статусу проверки.",
  alternates: { canonical: "/library" },
};

export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  const filters = parseLibraryFilters(await searchParams);
  return (
    <>
      <PageHeader eyebrow="Библиотека" title="Библиотека решений">
        Ищите по педагогической задаче, а не только по названию: поиск учитывает описание, шаги, теги и примеры применения.
      </PageHeader>
      <LibraryView filters={filters} basePath="/library" />
    </>
  );
}
