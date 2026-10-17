import { prisma } from "@/lib/db";
import type { Actor } from "@/server/permissions";

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "AuditLog","ModerationEvent","Report","Review","Bookmark","Attachment","ResearchIssue","ResearchResult","ResearchCriterion","ResearchTool","MaterialTag","MaterialCategory","Material","Research","Tag","Category","Session","User" CASCADE`,
  );
  const cats = await Promise.all([
    prisma.category.create({ data: { kind: "SUBJECT", slug: "any", name: "Любой предмет" } }),
    prisma.category.create({ data: { kind: "TASK", slug: "reflection", name: "Рефлексия и обратная связь" } }),
    prisma.category.create({ data: { kind: "TECHNOLOGY", slug: "no-tech", name: "Без цифровых технологий" } }),
  ]);
  const mk = (email: string, role: "USER" | "EDITOR" | "ADMIN") =>
    prisma.user.create({ data: { email, name: email.split("@")[0], role, passwordHash: "x" } });
  const [author, other, editor, admin] = await Promise.all([
    mk("author@t.io", "USER"),
    mk("other@t.io", "USER"),
    mk("editor@t.io", "EDITOR"),
    mk("admin@t.io", "ADMIN"),
  ]);
  const actor = (u: { id: string; role: Actor["role"] }): Actor => ({ id: u.id, role: u.role, isBlocked: false });
  return {
    subject: cats[0],
    task: cats[1],
    tech: cats[2],
    author: actor(author),
    other: actor(other),
    editor: actor(editor),
    admin: actor(admin),
  };
}

export function fullMaterial(ids: { subject: string; task: string; tech: string }, title = "Рефлексия за пять минут на стикерах") {
  return {
    type: "TIP",
    title,
    summary: "Короткая письменная рефлексия в конце урока, которая даёт учителю материал для планирования.",
    problem: "Рефлексия превращается в формальность и не даёт информации учителю.",
    audience: "Учителя 5–11 классов",
    gradeFrom: "5",
    gradeTo: "11",
    subjectIds: [ids.subject],
    taskIds: [ids.task],
    techIds: [ids.tech],
    tags: ["стикеры", "конец урока"],
    resources: "Стикеры",
    steps: ["Раздайте стикеры", "Соберите ответы"],
    example: "Пример",
    prepTimeMin: "5",
    lessonTimeMin: "5",
    cost: "FREE",
    costNote: "",
    digitalSkill: "BASIC",
    formats: ["OFFLINE"],
    limitations: "Быстро становится шаблонным при ежедневном использовании.",
    expectedResult: "Список затруднений класса.",
    adaptation: "",
    testReport: "",
    prompts: [],
    externalUrl: "",
    sources: "",
    license: "CC BY 4.0",
  };
}
