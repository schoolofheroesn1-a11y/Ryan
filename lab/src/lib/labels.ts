import type {
  CostLevel,
  CriterionDimension,
  DeliveryFormat,
  MaterialType,
  PublicationStatus,
  ReportReason,
  ReportStatus,
  ResearchKind,
  ReviewStatus,
  Role,
  SkillLevel,
  VerificationStatus,
} from "@prisma/client";

export const materialTypeLabels: Record<MaterialType, string> = {
  CASE: "Практический кейс",
  TIP: "Педагогическая фишка",
  TOOL_REVIEW: "Обзор инструмента",
  COMPARISON: "Сравнительное исследование",
  READY_MATERIAL: "Готовый учебный материал",
  INTERACTIVE: "Интерактив или мини-приложение",
  METHOD: "Методика или технология обучения",
  TEMPLATE: "Инструкция и шаблон",
};

export const materialTypeOrder: MaterialType[] = [
  "CASE",
  "TIP",
  "TOOL_REVIEW",
  "COMPARISON",
  "READY_MATERIAL",
  "INTERACTIVE",
  "METHOD",
  "TEMPLATE",
];

export const publicationStatusLabels: Record<PublicationStatus, string> = {
  DRAFT: "Черновик",
  PENDING: "На модерации",
  PUBLISHED: "Опубликовано",
  REJECTED: "Отклонено",
  UNPUBLISHED: "Снято с публикации",
};

export const verificationLabels: Record<VerificationStatus, string> = {
  NOT_TESTED: "Не тестировалось",
  AUTHOR_TESTED: "Проверено автором",
  MULTI_TEACHER: "Проверено несколькими педагогами",
  INDEPENDENT: "Есть независимое подтверждение",
  NEEDS_RECHECK: "Требует повторной проверки",
};

export const verificationOrder: VerificationStatus[] = [
  "NOT_TESTED",
  "AUTHOR_TESTED",
  "MULTI_TEACHER",
  "INDEPENDENT",
  "NEEDS_RECHECK",
];

export const costLabels: Record<CostLevel, string> = {
  FREE: "Бесплатно",
  FREEMIUM: "Бесплатно с ограничениями",
  PAID: "Платно",
};

export const skillLabels: Record<SkillLevel, string> = {
  BASIC: "Базовые навыки",
  MEDIUM: "Уверенный пользователь",
  ADVANCED: "Продвинутый уровень",
};

export const formatLabels: Record<DeliveryFormat, string> = {
  OFFLINE: "Очно",
  ONLINE: "Дистанционно",
  BLENDED: "Смешанно",
};

export const researchKindLabels: Record<ResearchKind, string> = {
  TECHNICAL: "Проверка технических возможностей",
  TEACHER_REVIEW: "Оценка педагогами",
  STUDENT_OUTCOMES: "Измерение результатов учеников",
};

export const researchKindHints: Record<ResearchKind, string> = {
  TECHNICAL:
    "Проверяли, что инструмент умеет и насколько качественно. Это не доказательство влияния на обучение.",
  TEACHER_REVIEW:
    "Педагоги применяли решение и оценивали его по заранее заданным критериям. Результаты учеников не измерялись.",
  STUDENT_OUTCOMES:
    "Измерялись результаты учеников по заранее описанной методике. Смотрите ограничения выборки.",
};

export const dimensionLabels: Record<CriterionDimension, string> = {
  TECHNICAL: "Техническая работоспособность",
  INTERFACE: "Удобство интерфейса",
  PEDAGOGICAL: "Педагогическая ценность",
  RESOURCES: "Ресурсы: время, деньги, доступность",
};

export const dimensionOrder: CriterionDimension[] = ["TECHNICAL", "PEDAGOGICAL", "INTERFACE", "RESOURCES"];

export const reviewStatusLabels: Record<ReviewStatus, string> = {
  PENDING: "Ожидает проверки",
  APPROVED: "Опубликован",
  REJECTED: "Отклонён",
};

export const reportReasonLabels: Record<ReportReason, string> = {
  ERROR: "Ошибка в содержании",
  OUTDATED: "Информация устарела",
  MISMATCH: "Описание не соответствует действительности",
  COPYRIGHT: "Нарушение авторских прав",
  INAPPROPRIATE: "Недопустимое содержание",
  OTHER: "Другое",
};

export const reportStatusLabels: Record<ReportStatus, string> = {
  OPEN: "Открыта",
  RESOLVED: "Решена",
  DISMISSED: "Отклонена",
};

export const roleLabels: Record<Role, string> = {
  USER: "Пользователь",
  EDITOR: "Редактор",
  ADMIN: "Администратор",
};

export const categoryKindLabels = {
  SUBJECT: "Предметы",
  TASK: "Педагогические задачи",
  TECHNOLOGY: "Типы технологий",
} as const;

export const licenseOptions = [
  "CC BY 4.0 — свободное использование с указанием автора",
  "CC BY-SA 4.0 — с указанием автора и на тех же условиях",
  "CC BY-NC 4.0 — с указанием автора, без коммерческого использования",
  "Использование в образовательных целях с указанием автора",
  "Все права защищены — только ознакомление",
];
