import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-redirect";
import { slugify } from "@/lib/slug";
import { materialDraftSchema, materialFormToObject, materialSubmitSchema, sniffMatches, validateAttachment } from "@/lib/validation";
import { canEditMaterial, canViewMaterial } from "@/server/permissions";

function form(entries: [string, string][]) {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

describe("валидация материала", () => {
  const minimal = form([["type", "TIP"], ["title", "Черновик"]]);

  it("черновик сохраняется с минимумом полей, а отправка требует полного заполнения", () => {
    const obj = materialFormToObject(minimal);
    expect(materialDraftSchema.safeParse(obj).success).toBe(true);
    const submit = materialSubmitSchema.safeParse(obj);
    expect(submit.success).toBe(false);
    const fields = submit.error!.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["summary", "problem", "steps", "license", "prepTimeMin"]));
  });

  it("разбирает шаги по строкам, промпты по разделителю и теги по запятым", () => {
    const obj = materialFormToObject(form([["steps", "Шаг 1\n\nШаг 2\n"], ["prompts", "A\n---\nB"], ["tags", "игра, , квест"]]));
    expect(obj.steps).toEqual(["Шаг 1", "Шаг 2"]);
    expect(obj.prompts).toEqual(["A", "B"]);
    expect(obj.tags).toEqual(["игра", "квест"]);
  });

  it("не принимает javascript-ссылки и ошибочный диапазон классов", () => {
    const obj = { ...materialFormToObject(minimal), externalUrl: "javascript:alert(1)" };
    expect(materialDraftSchema.safeParse(obj).success).toBe(false);
  });
});

describe("вложения", () => {
  it("проверяет тип, расширение и размер", () => {
    expect(validateAttachment({ name: "a.pdf", type: "application/pdf", size: 100 })).toBeNull();
    expect(validateAttachment({ name: "a.exe", type: "application/pdf", size: 100 })).not.toBeNull();
    expect(validateAttachment({ name: "a.pdf", type: "application/pdf", size: 11 * 1024 * 1024 })).not.toBeNull();
    expect(validateAttachment({ name: "a.html", type: "text/html", size: 10 })).not.toBeNull();
    // Windows отдаёт CSV как application/vnd.ms-excel, некоторые браузеры — пустой тип
    expect(validateAttachment({ name: "data.csv", type: "application/vnd.ms-excel", size: 10 })).toBeNull();
    expect(validateAttachment({ name: "plan.docx", type: "", size: 10 })).toBeNull();
  });
  it("сверяет сигнатуру содержимого", () => {
    expect(sniffMatches("application/pdf", new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(true);
    expect(sniffMatches("image/png", new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(false);
  });
});

describe("служебные функции", () => {
  it("safeNext не допускает перенаправления на внешние сайты", () => {
    expect(safeNext("/me")).toBe("/me");
    expect(safeNext("//evil.com")).toBe("/me");
    expect(safeNext("https://evil.com")).toBe("/me");
  });
  it("slugify транслитерирует кириллицу", () => {
    expect(slugify("Рефлексия за 5 минут!")).toBe("refleksiya-za-5-minut");
  });
  it("права доступа к материалам", () => {
    const pending = { status: "PENDING" as const, authorId: "a" };
    expect(canViewMaterial(null, pending)).toBe(false);
    expect(canViewMaterial({ id: "b", role: "USER", isBlocked: false }, pending)).toBe(false);
    expect(canViewMaterial({ id: "a", role: "USER", isBlocked: false }, pending)).toBe(true);
    expect(canEditMaterial({ id: "a", role: "USER", isBlocked: false }, pending)).toBe(false);
    expect(canEditMaterial({ id: "e", role: "EDITOR", isBlocked: false }, pending)).toBe(true);
    expect(canEditMaterial({ id: "e", role: "EDITOR", isBlocked: true }, pending)).toBe(false);
  });
});
