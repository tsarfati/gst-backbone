import { Building2, Droplets, FileText, Flame, HardHat, Wrench, Wind, Zap } from "lucide-react";

export interface PlanDisciplineSource {
  plan_name?: string | null;
  plan_number?: string | null;
  discipline?: string | null;
}

export function getPlanDisciplineKey(plan: PlanDisciplineSource) {
  const discipline = String(plan.discipline || "").toLowerCase().trim();
  const text = `${plan.plan_name || ""} ${plan.plan_number || ""}`.toLowerCase();
  const planNo = (plan.plan_number || "").toLowerCase();

  if (/\b(plumb|plumbing|sanitary|waste|vent|domestic water)\b/.test(discipline)) return "plumbing";
  if (/\b(electrical|power|lighting|low voltage|telecom)\b/.test(discipline)) return "electrical";
  if (/\b(mechanical|hvac|duct|air handling)\b/.test(discipline)) return "mechanical";
  if (/\b(fire protection|sprinkler|fire alarm)\b/.test(discipline)) return "fire";
  if (/\b(structural|foundation|steel|framing)\b/.test(discipline)) return "structural";
  if (/\b(civil|site|grading|utility plan)\b/.test(discipline)) return "civil";
  if (/\b(architect|architectural|floor plan|elevation|section|detail|general)\b/.test(discipline)) return "architectural";

  if (
    /\b(plumb|plumbing|sanitary|waste|vent|domestic water)\b/.test(text) ||
    /^[p][-\s]?\d/.test(planNo)
  ) return "plumbing";
  if (
    /\b(electrical|power|lighting|low voltage|telecom)\b/.test(text) ||
    /^[e][-\s]?\d/.test(planNo)
  ) return "electrical";
  if (
    /\b(mechanical|hvac|duct|air handling)\b/.test(text) ||
    /^[m][-\s]?\d/.test(planNo)
  ) return "mechanical";
  if (
    /\b(fire protection|sprinkler|fire alarm)\b/.test(text) ||
    /^[fp][-\s]?\d/.test(planNo)
  ) return "fire";
  if (
    /\b(structural|foundation|steel|framing)\b/.test(text) ||
    /^[s][-\s]?\d/.test(planNo)
  ) return "structural";
  if (
    /\b(civil|site|grading|utility plan)\b/.test(text) ||
    /^[c][-\s]?\d/.test(planNo)
  ) return "civil";
  if (
    /\b(architect|architectural|floor plan|elevation|section|detail)\b/.test(text) ||
    /^[a][-\s]?\d/.test(planNo)
  ) return "architectural";

  return "general";
}

export function PlanDisciplineIcon({
  plan,
  className = "h-8 w-8",
}: {
  plan: PlanDisciplineSource;
  className?: string;
}) {
  const key = getPlanDisciplineKey(plan);

  switch (key) {
    case "plumbing":
      return <Droplets className={`${className} text-sky-500`} />;
    case "electrical":
      return <Zap className={`${className} text-amber-500`} />;
    case "mechanical":
      return <Wind className={`${className} text-cyan-500`} />;
    case "fire":
      return <Flame className={`${className} text-red-500`} />;
    case "structural":
      return <Building2 className={`${className} text-stone-500`} />;
    case "civil":
      return <HardHat className={`${className} text-yellow-600`} />;
    case "architectural":
      return <Wrench className={`${className} text-indigo-500`} />;
    default:
      return <FileText className={`${className} text-primary`} />;
  }
}
