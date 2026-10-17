import type { Metadata } from "next";
import { VerificationBadge } from "@/components/ui/badges";
import { PageHeader } from "@/components/ui/page-header";
import { dimensionLabels, dimensionOrder, researchKindHints, researchKindLabels, verificationOrder } from "@/lib/labels";
import { verificationCriteria } from "@/lib/verification";

export const metadata: Metadata = {
  title: "Методика и статусы проверки",
  description: "Как лаборатория испытывает образовательные технологии: шаблон оценки, критерии и веса, критические ошибки, виды проверки и требования к статусам материалов.",
  alternates: { canonical: "/methodology" },
};

const template = [
  ["Функциональность", "Умеет ли инструмент выполнить педагогическую задачу целиком."],
  ["Качество результата", "Насколько результат пригоден для использования без доработки."],
  ["Фактическая точность", "Есть ли фактические ошибки (если применимо)."],
  ["Удобство", "Сколько действий и знаний нужно учителю."],
  ["Стоимость", "Бесплатный режим, ограничения, цена платного доступа."],
  ["Время на выполнение задачи", "Сколько времени уходит от начала работы до результата."],
  ["Время на исправления", "Сколько времени учитель тратит на проверку и доработку."],
  ["Доступность в российских условиях", "Работает ли сервис без обходных путей, можно ли оплатить."],
  ["Риски и ограничения", "Персональные данные, возрастные ограничения, зависимость от интернета."],
  ["Воспроизводимость", "Даёт ли повторный запуск сопоставимый результат."],
];

export default function MethodologyPage() {
  return (
    <>
      <PageHeader eyebrow="Методика" title="Как мы проверяем технологии и что означают статусы">
        Главный принцип: не рассказывать, что технология умеет, а проверять, какую педагогическую задачу она решает, насколько хорошо, сколько ресурсов требует и кому подходит.
      </PageHeader>
      <div className="container-page flex max-w-4xl flex-col gap-12 py-10">
        <section aria-labelledby="statuses" id="statuses" className="scroll-mt-24">
          <h2 id="statuses" className="font-display text-2xl font-semibold">Статусы проверки материалов</h2>
          <p className="mt-2 text-ink-soft">
            Статус не присваивается автоматически. Его меняет редакция, но сервер не позволит выбрать статус, требования которого не выполнены. Каждое изменение записывается в историю материала.
          </p>
          <ol className="mt-6 flex flex-col gap-4">
            {verificationOrder.map((s) => (
              <li key={s} className="card p-5">
                <VerificationBadge status={s} />
                <p className="mt-3 font-medium">{verificationCriteria[s].summary}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[14.5px] text-ink-soft">
                  {verificationCriteria[s].requirements.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="kinds">
          <h2 id="kinds" className="font-display text-2xl font-semibold">Три вида проверки — три силы вывода</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {(["TECHNICAL", "TEACHER_REVIEW", "STUDENT_OUTCOMES"] as const).map((k) => (
              <div key={k} className="card p-5">
                <h3 className="font-semibold">{researchKindLabels[k]}</h3>
                <p className="mt-2 text-[14px] text-ink-soft">{researchKindHints[k]}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[15px] text-ink-soft">
            Впечатления автора не считаются доказательством эффективности обучения. Об эффективности для учеников можно говорить только по результатам
            испытаний третьего вида, и то с учётом ограничений выборки.
          </p>
        </section>

        <section aria-labelledby="template">
          <h2 id="template" className="font-display text-2xl font-semibold">Единый шаблон оценки</h2>
          <p className="mt-2 text-ink-soft">Для каждого испытания фиксируются следующие параметры. Не все применимы к каждому инструменту — неприменимые отмечаются явно.</p>
          <dl className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {template.map(([t, d]) => (
              <div key={t}>
                <dt className="font-medium">{t}</dt>
                <dd className="text-[14.5px] text-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="rules">
          <h2 id="rules" className="font-display text-2xl font-semibold">Правила испытаний</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-[15.5px] leading-relaxed text-ink-soft">
            <li><b className="text-ink">Критерии и веса задаются до испытания.</b> Пока критерии не зафиксированы, результаты внести нельзя; после фиксации критерии и состав участников изменить нельзя.</li>
            <li><b className="text-ink">Одинаковые исходные задания.</b> При сравнении нескольких инструментов все получают одни и те же входные данные и запросы; версии инструментов записываются.</li>
            <li>
              <b className="text-ink">Измерения не смешиваются.</b> Оценки считаются отдельно по измерениям:{" "}
              {dimensionOrder.map((d) => dimensionLabels[d].toLowerCase()).join("; ")}. Общего балла нет.
            </li>
            <li><b className="text-ink">Критические ошибки отдельно.</b> Ошибка, из-за которой результат нельзя использовать (например, неверный правильный ответ в тесте), выводится в первой строке таблицы и определяет итог независимо от остальных оценок.</li>
            <li><b className="text-ink">Воспроизводимость.</b> К каждому испытанию прилагаются материалы и порядок действий для повторения.</li>
            <li><b className="text-ink">Учебные примеры помечаются.</b> Демонстрационные отчёты показывают формат и не являются результатом реальных испытаний.</li>
          </ol>
        </section>

        <section aria-labelledby="community">
          <h2 id="community" className="font-display text-2xl font-semibold">Отзывы и сообщения об ошибках</h2>
          <p className="mt-2 text-[15.5px] leading-relaxed text-ink-soft">
            Отзывы публикуются только после проверки редакцией. Отзыв с отметкой «применял на практике» должен описывать контекст применения — такие отзывы
            учитываются для статуса «Проверено несколькими педагогами». Сообщения об ошибках видит только редакция; по подтверждённому сообщению материал
            может получить статус «Требует повторной проверки» или быть снят с публикации.
          </p>
        </section>
      </div>
    </>
  );
}
