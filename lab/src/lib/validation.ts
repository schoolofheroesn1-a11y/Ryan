import { z } from "zod";

const trimmed = (max: number) => z.string().trim().max(max, `Не длиннее ${max} символов`);

const optionalInt = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z
      .number({ message: `${label}: укажите число` })
      .int(`${label}: укажите целое число`)
      .min(min, `${label}: не меньше ${min}`)
      .max(max, `${label}: не больше ${max}`)
      .nullable(),
  );

const safeUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), "Ссылка должна начинаться с http:// или https://");

export const materialTypes = [
  "CASE",
  "TIP",
  "TOOL_REVIEW",
  "COMPARISON",
  "READY_MATERIAL",
  "INTERACTIVE",
  "METHOD",
  "TEMPLATE",
] as const;

/** Черновик: допускает незаполненные поля, но ограничивает размер и формат. */
export const materialDraftSchema = z.object({
  type: z.enum(materialTypes, { message: "Выберите тип публикации" }),
  title: trimmed(160).min(3, "Название: минимум 3 символа"),
  summary: trimmed(600),
  problem: trimmed(2000),
  audience: trimmed(1000),
  gradeFrom: optionalInt(1, 11, "Класс «с»"),
  gradeTo: optionalInt(1, 11, "Класс «по»"),
  subjectIds: z.array(z.string().max(40)).max(10),
  taskIds: z.array(z.string().max(40)).max(10),
  techIds: z.array(z.string().max(40)).max(10),
  tags: z.array(trimmed(40).min(2)).max(12, "Не больше 12 тегов"),
  resources: trimmed(3000),
  steps: z.array(trimmed(1500)).max(30, "Не больше 30 шагов"),
  example: trimmed(5000),
  prepTimeMin: optionalInt(0, 6000, "Время подготовки"),
  lessonTimeMin: optionalInt(0, 6000, "Время на занятии"),
  cost: z.enum(["FREE", "FREEMIUM", "PAID"]),
  costNote: trimmed(500),
  digitalSkill: z.enum(["BASIC", "MEDIUM", "ADVANCED"]),
  formats: z.array(z.enum(["OFFLINE", "ONLINE", "BLENDED"])).max(3),
  limitations: trimmed(3000),
  expectedResult: trimmed(3000),
  adaptation: trimmed(3000),
  testReport: trimmed(5000),
  prompts: z.array(trimmed(4000)).max(10, "Не больше 10 промптов"),
  externalUrl: safeUrl,
  sources: trimmed(3000),
  license: trimmed(200),
});

export type MaterialInput = z.infer<typeof materialDraftSchema>;

/** Отправка на модерацию: все ключевые разделы страницы материала обязательны. */
export const materialSubmitSchema = materialDraftSchema.superRefine((d, ctx) => {
  const need = (field: keyof MaterialInput, ok: boolean, message: string) => {
    if (!ok) ctx.addIssue({ code: "custom", path: [field], message });
  };
  need("summary", d.summary.length >= 30, "Краткое описание: минимум 30 символов");
  need("problem", d.problem.length >= 20, "Опишите педагогическую задачу (минимум 20 символов)");
  need("audience", d.audience.length >= 5, "Укажите, для кого подходит решение");
  need("subjectIds", d.subjectIds.length > 0, "Выберите хотя бы один предмет или «Любой предмет»");
  need("taskIds", d.taskIds.length > 0, "Выберите хотя бы одну педагогическую задачу");
  need("steps", d.steps.length >= 2, "Добавьте минимум два шага инструкции");
  need("prepTimeMin", d.prepTimeMin != null, "Укажите время подготовки");
  need("formats", d.formats.length > 0, "Укажите формат проведения");
  need("limitations", d.limitations.length >= 10, "Опишите ограничения и возможные проблемы");
  need("expectedResult", d.expectedResult.length >= 10, "Опишите ожидаемый результат");
  need("license", d.license.length > 0, "Выберите условия использования");
  if (d.gradeFrom != null && d.gradeTo != null && d.gradeFrom > d.gradeTo)
    ctx.addIssue({ code: "custom", path: ["gradeTo"], message: "Класс «по» не может быть меньше класса «с»" });
});

function list(form: FormData, key: string): string[] {
  return form.getAll(key).map(String).filter(Boolean);
}

/** Превращает FormData формы материала в объект для валидации. */
export function materialFormToObject(form: FormData) {
  const lines = (v: FormDataEntryValue | null) =>
    String(v ?? "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  return {
    type: String(form.get("type") ?? ""),
    title: String(form.get("title") ?? ""),
    summary: String(form.get("summary") ?? ""),
    problem: String(form.get("problem") ?? ""),
    audience: String(form.get("audience") ?? ""),
    gradeFrom: form.get("gradeFrom"),
    gradeTo: form.get("gradeTo"),
    subjectIds: list(form, "subjectIds"),
    taskIds: list(form, "taskIds"),
    techIds: list(form, "techIds"),
    tags: String(form.get("tags") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    resources: String(form.get("resources") ?? ""),
    steps: lines(form.get("steps")),
    example: String(form.get("example") ?? ""),
    prepTimeMin: form.get("prepTimeMin"),
    lessonTimeMin: form.get("lessonTimeMin"),
    cost: String(form.get("cost") ?? "FREE"),
    costNote: String(form.get("costNote") ?? ""),
    digitalSkill: String(form.get("digitalSkill") ?? "BASIC"),
    formats: list(form, "formats"),
    limitations: String(form.get("limitations") ?? ""),
    expectedResult: String(form.get("expectedResult") ?? ""),
    adaptation: String(form.get("adaptation") ?? ""),
    testReport: String(form.get("testReport") ?? ""),
    prompts: String(form.get("prompts") ?? "")
      .split(/\n-{3,}\n/)
      .map((s) => s.trim())
      .filter(Boolean),
    externalUrl: String(form.get("externalUrl") ?? ""),
    sources: String(form.get("sources") ?? ""),
    license: String(form.get("license") ?? ""),
  };
}

export type FieldErrors = Partial<Record<string, string>>;

export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export const registerSchema = z.object({
  name: trimmed(80).min(2, "Имя или псевдоним: минимум 2 символа"),
  email: z.string().trim().toLowerCase().max(200).email("Некорректный адрес почты"),
  password: z.string().min(8, "Пароль: минимум 8 символов").max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(200).email("Некорректный адрес почты"),
  password: z.string().min(1, "Введите пароль").max(200),
});

export const profileSchema = z.object({
  name: trimmed(80).min(2, "Имя или псевдоним: минимум 2 символа"),
  specialization: trimmed(200),
  bio: trimmed(2000),
  links: z.array(safeUrl.refine((v) => v !== "")).max(5, "Не больше 5 ссылок"),
});

export const reviewSchema = z.object({
  body: trimmed(3000).min(20, "Отзыв: минимум 20 символов"),
  appliedInPractice: z.boolean(),
  context: trimmed(1000),
}).superRefine((d, ctx) => {
  if (d.appliedInPractice && d.context.length < 10)
    ctx.addIssue({ code: "custom", path: ["context"], message: "Опишите, где и как вы применяли решение" });
});

export const reportSchema = z.object({
  reason: z.enum(["ERROR", "OUTDATED", "MISMATCH", "COPYRIGHT", "INAPPROPRIATE", "OTHER"], {
    message: "Выберите причину",
  }),
  body: trimmed(2000).min(10, "Опишите проблему (минимум 10 символов)"),
});

/** Разрешённые вложения: учебные документы и изображения. */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const allowedAttachmentTypes: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.oasis.opendocument.text": [".odt"],
  "application/vnd.oasis.opendocument.presentation": [".odp"],
  "text/plain": [".txt"],
  "text/csv": [".csv"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
};

export function validateAttachment(file: { name: string; type: string; size: number }): string | null {
  if (file.size === 0) return "Файл пустой";
  if (file.size > ATTACHMENT_MAX_BYTES) return "Файл больше 10 МБ";
  const ext = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
  const allowed = allowedAttachmentTypes[file.type];
  if (!allowed || !allowed.includes(ext))
    return "Недопустимый тип файла. Разрешены PDF, DOCX, PPTX, XLSX, ODT, ODP, TXT, CSV, PNG, JPG";
  return null;
}

/** Проверка сигнатуры файла: расширение и MIME присылает клиент, им нельзя доверять. */
export function sniffMatches(mime: string, head: Uint8Array): boolean {
  const starts = (...bytes: number[]) => bytes.every((b, i) => head[i] === b);
  if (mime === "application/pdf") return starts(0x25, 0x50, 0x44, 0x46);
  if (mime === "image/png") return starts(0x89, 0x50, 0x4e, 0x47);
  if (mime === "image/jpeg") return starts(0xff, 0xd8, 0xff);
  if (mime.startsWith("application/vnd.")) return starts(0x50, 0x4b, 0x03, 0x04); // ZIP-контейнер
  if (mime.startsWith("text/")) return !head.includes(0);
  return false;
}
