import type { Material, MaterialCategory, MaterialTag, Category, Tag } from "@prisma/client";
import type { MaterialFormValues } from "@/components/forms/material-form";
import { getTaxonomy } from "./search";

export function materialToFormValues(
  m: Material & { categories: (MaterialCategory & { category: Category })[]; tags: (MaterialTag & { tag: Tag })[] },
): MaterialFormValues {
  const ids = (kind: string) => m.categories.filter((c) => c.category.kind === kind).map((c) => c.categoryId);
  return {
    type: m.type,
    title: m.title,
    summary: m.summary,
    problem: m.problem,
    audience: m.audience,
    gradeFrom: m.gradeFrom?.toString() ?? "",
    gradeTo: m.gradeTo?.toString() ?? "",
    subjectIds: ids("SUBJECT"),
    taskIds: ids("TASK"),
    techIds: ids("TECHNOLOGY"),
    tags: m.tags.map((t) => t.tag.name).join(", "),
    resources: m.resources,
    steps: m.steps,
    example: m.example,
    prepTimeMin: m.prepTimeMin?.toString() ?? "",
    lessonTimeMin: m.lessonTimeMin?.toString() ?? "",
    cost: m.cost,
    costNote: m.costNote,
    digitalSkill: m.digitalSkill,
    formats: m.formats,
    limitations: m.limitations,
    expectedResult: m.expectedResult,
    adaptation: m.adaptation,
    testReport: m.testReport,
    prompts: m.prompts,
    externalUrl: m.externalUrl ?? "",
    sources: m.sources,
    license: m.license,
  };
}

export async function taxonomyOptions() {
  const t = await getTaxonomy();
  const map = (list: { id: string; name: string }[]) => list.map((c) => ({ value: c.id, label: c.name }));
  return { subjects: map(t.subjects), tasks: map(t.tasks), techs: map(t.techs) };
}
