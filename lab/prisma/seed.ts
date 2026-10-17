/**
 * Наполнение базы: справочники, служебные аккаунты и демонстрационные данные.
 * Запуск: npm run db:seed. Повторный запуск пересоздаёт демо-данные.
 * Демо-данные помечены isDemo и удаляются командой npm run db:purge-demo.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { subjects, tasks, techs } from "./demo/taxonomy";
import { demoMaterials, pendingDemoMaterial, type DemoMaterial } from "./demo/materials";
import { demoResearch } from "./demo/research";
import { slugify } from "../src/lib/slug";

const prisma = new PrismaClient();
const day = 86400000;

async function upsertUser(email: string, password: string, data: { name: string; role: "USER" | "EDITOR" | "ADMIN"; isDemo: boolean; specialization?: string; bio?: string }) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: { name: data.name, role: data.role, isDemo: data.isDemo, specialization: data.specialization, bio: data.bio },
    create: { email, passwordHash, ...data },
  });
}

async function main() {
  // Справочники
  for (const [kind, list] of [["SUBJECT", subjects], ["TASK", tasks], ["TECHNOLOGY", techs]] as const) {
    let order = 0;
    for (const [slug, name] of list) {
      await prisma.category.upsert({
        where: { kind_slug: { kind, slug } },
        update: { name, order },
        create: { kind, slug, name, order },
      });
      order++;
    }
  }
  const categories = await prisma.category.findMany();
  const cat = (kind: string, slug: string) => {
    const c = categories.find((x) => x.kind === kind && x.slug === slug);
    if (!c) throw new Error(`Нет категории ${kind}/${slug}`);
    return c;
  };

  // Служебные аккаунты. В продакшене задайте пароли через переменные окружения.
  const admin = await upsertUser(
    process.env.SEED_ADMIN_EMAIL || "admin@example.org",
    process.env.SEED_ADMIN_PASSWORD || "admin-demo-password",
    { name: "Администратор", role: "ADMIN", isDemo: false },
  );
  if (process.env.SEED_DEMO === "false") {
    console.log("Демо-данные пропущены (SEED_DEMO=false). Администратор:", admin.email);
    return;
  }
  const editor = await upsertUser("editor@example.org", "editor-demo-password", {
    name: "Редактор (демо)",
    role: "EDITOR",
    isDemo: true,
    specialization: "Демонстрационный профиль редактора лаборатории.",
  });
  const author = await upsertUser("demo-author@example.org", "author-demo-password", {
    name: "Редакция лаборатории (демо)",
    role: "USER",
    isDemo: true,
    specialization: "Демонстрационный профиль. Материалы этого автора — примеры формата, не результат реальной практики.",
  });
  const teacher = await upsertUser("teacher@example.org", "teacher-demo-password", {
    name: "Учитель (демо)",
    role: "USER",
    isDemo: true,
    specialization: "Демонстрационный профиль для проверки пользовательских сценариев.",
  });

  // Пересоздаём демо-контент
  await prisma.material.deleteMany({ where: { isDemo: true } });
  await prisma.research.deleteMany({ where: { isDemo: true } });

  const researchIds = new Map<string, string>();
  for (const r of demoResearch) {
    const createdAt = new Date(Date.now() - r.daysAgo * day);
    const research = await prisma.research.create({
      data: {
        slug: r.slug,
        title: r.title,
        summary: r.summary,
        kind: r.kind,
        status: "PUBLISHED",
        question: r.question,
        hypothesis: r.hypothesis,
        conditions: r.conditions,
        limitations: r.limitations,
        inputTasks: r.inputTasks,
        rawResults: r.rawResults,
        errorsFound: r.errorsFound,
        resourceCosts: r.resourceCosts,
        manualRework: r.manualRework,
        pedagogicalCheck: r.pedagogicalCheck,
        conclusions: r.conclusions,
        recommendations: r.recommendations,
        reproduction: r.reproduction,
        isDemo: true,
        authorId: editor.id,
        criteriaLockedAt: new Date(createdAt.getTime() - 5 * day),
        createdAt,
        publishedAt: createdAt,
      },
    });
    researchIds.set(r.slug, research.id);
    const toolIds = new Map<string, string>();
    for (const [i, t] of r.tools.entries()) {
      const tool = await prisma.researchTool.create({
        data: { researchId: research.id, name: t.name, version: t.version, vendor: t.vendor, pricing: t.pricing, availability: t.availability, order: i },
      });
      toolIds.set(t.key, tool.id);
    }
    const criterionIds = new Map<string, string>();
    for (const [i, c] of r.criteria.entries()) {
      const criterion = await prisma.researchCriterion.create({
        data: { researchId: research.id, name: c.name, description: c.description, dimension: c.dimension, weight: c.weight, scaleMax: c.scaleMax, order: i },
      });
      criterionIds.set(c.key, criterion.id);
    }
    for (const [toolKey, scores] of Object.entries(r.scores)) {
      for (const [critKey, [score, note]] of Object.entries(scores)) {
        await prisma.researchResult.create({
          data: { researchId: research.id, toolId: toolIds.get(toolKey)!, criterionId: criterionIds.get(critKey)!, score, note: note ?? "" },
        });
      }
    }
    for (const issue of r.issues) {
      await prisma.researchIssue.create({
        data: { researchId: research.id, toolId: toolIds.get(issue.tool)!, description: issue.description, isCritical: issue.isCritical },
      });
    }
  }

  const createMaterial = async (m: DemoMaterial, authorId: string, status: "PUBLISHED" | "PENDING") => {
    const date = new Date(Date.now() - m.daysAgo * day);
    const cats = [
      ...m.subjects.map((s) => cat("SUBJECT", s)),
      ...m.tasks.map((s) => cat("TASK", s)),
      ...m.techs.map((s) => cat("TECHNOLOGY", s)),
    ];
    const tagIds: string[] = [];
    for (const name of m.tags) {
      const slug = slugify(name, 40);
      const tag = await prisma.tag.upsert({ where: { slug }, update: {}, create: { slug, name } });
      tagIds.push(tag.id);
    }
    const searchText = [m.audience, m.resources, m.steps.join(" "), m.example, m.expectedResult, m.adaptation, m.limitations, (m.prompts ?? []).join(" "), m.tags.join(" "), cats.map((c) => c.name).join(" ")].join(" \n");
    const material = await prisma.material.create({
      data: {
        slug: m.slug,
        type: m.type,
        status,
        verificationStatus: "NOT_TESTED",
        title: m.title,
        summary: m.summary,
        problem: m.problem,
        audience: m.audience,
        gradeFrom: m.gradeFrom,
        gradeTo: m.gradeTo,
        resources: m.resources,
        steps: m.steps,
        example: m.example,
        prepTimeMin: m.prepTimeMin,
        lessonTimeMin: m.lessonTimeMin,
        cost: m.cost,
        costNote: m.costNote ?? "",
        digitalSkill: m.digitalSkill,
        formats: m.formats,
        limitations: m.limitations,
        expectedResult: m.expectedResult,
        adaptation: m.adaptation,
        prompts: m.prompts ?? [],
        sources: m.sources,
        license: m.license,
        isDemo: true,
        searchText,
        authorId,
        researchId: m.research ? researchIds.get(m.research) : null,
        createdAt: date,
        publishedAt: status === "PUBLISHED" ? date : null,
        categories: { create: cats.map((c) => ({ categoryId: c.id })) },
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
    await prisma.moderationEvent.create({
      data: { materialId: material.id, actorId: authorId, fromStatus: null, toStatus: "PENDING", comment: "Отправлено на модерацию", createdAt: date },
    });
    if (status === "PUBLISHED") {
      await prisma.moderationEvent.create({
        data: { materialId: material.id, actorId: editor.id, fromStatus: "PENDING", toStatus: "PUBLISHED", comment: "Демонстрационный материал", createdAt: date },
      });
    }
    // updatedAt выставляется Prisma автоматически — приводим к дате публикации
    await prisma.$executeRaw`UPDATE "Material" SET "updatedAt" = ${date} WHERE "id" = ${material.id}`;
    return material;
  };

  for (const m of demoMaterials) await createMaterial(m, author.id, "PUBLISHED");
  await createMaterial(pendingDemoMaterial, teacher.id, "PENDING");

  const total = await prisma.material.count();
  console.log(`Готово: материалов ${total}, исследований ${await prisma.research.count()}.`);
  console.log(`Администратор: ${admin.email}. Демо-аккаунты: editor@, demo-author@, teacher@example.org (пароли в README).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
