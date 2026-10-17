import type { Metadata } from "next";
import { LibraryView } from "@/components/library-view";
import { PageHeader } from "@/components/ui/page-header";
import { parseLibraryFilters } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Фишки и кейсы",
  description: "Короткие практические решения: что можно сделать на ближайшем уроке — сценарий, шаги, ресурсы, время подготовки и ограничения.",
  alternates: { canonical: "/practice" },
};

export default async function PracticePage({ searchParams }: PageProps<"/practice">) {
  const filters = parseLibraryFilters(await searchParams);
  return (
    <>
      <PageHeader eyebrow="Фишки и кейсы" title="Что я могу сделать на ближайшем уроке?">
        Короткие приёмы и описания реального применения: сценарий, последовательность действий, ресурсы, время подготовки и ограничения.
      </PageHeader>
      <LibraryView filters={filters} basePath="/practice" fixedTypes={["TIP", "CASE"]} />
    </>
  );
}
