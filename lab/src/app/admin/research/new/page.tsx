import { ResearchForm } from "@/components/forms/research-form";
import { requirePageStaff } from "@/server/auth";

export default async function NewResearchPage() {
  await requirePageStaff();
  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-semibold">Новое исследование</h1>
      <p className="mb-5 text-[14px] text-muted">После сохранения добавьте участников и критерии с весами, зафиксируйте их и только затем вносите результаты.</p>
      <ResearchForm initial={{}} />
    </div>
  );
}
