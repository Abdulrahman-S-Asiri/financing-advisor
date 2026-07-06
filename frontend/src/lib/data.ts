// Domain labels and demo personas — ported from v1 (the behavioral reference).
// Persona numbers mirror mock_open_banking/personas.py; they are seeded demo
// data, not real customers.

export type PersonaId = "ahmed_borderline" | "sara_strong" | "khalid_rejected";

export type Persona = {
  id: PersonaId;
  name: string;
  label: string;
  summary: string;
  amount: number;
  tenor: number;
  age: number;
};

export const personas: Persona[] = [
  {
    id: "ahmed_borderline",
    name: "أحمد",
    label: "حالة حدية",
    summary: "راتب خاص مع التزامات شهرية، مناسب لإظهار القبول والرفض معاً.",
    amount: 80000,
    tenor: 48,
    age: 28,
  },
  {
    id: "sara_strong",
    name: "سارة",
    label: "ملف قوي",
    summary: "راتب حكومي ومساحة تمويلية مريحة، مناسب لإظهار أفضل عرض.",
    amount: 60000,
    tenor: 36,
    age: 31,
  },
  {
    id: "khalid_rejected",
    name: "خالد",
    label: "رفض مفسر",
    summary: "التزامات عالية مقابل الراتب، مناسب لإظهار أسباب الرفض بوضوح.",
    amount: 50000,
    tenor: 36,
    age: 35,
  },
];

export function findPersona(id: string | undefined | null): Persona | null {
  return personas.find((persona) => persona.id === id) ?? null;
}

export type MatchStatus = "eligible" | "conditional" | "ineligible" | "policy_review";
export type SortMode = "ranked" | "apr" | "installment" | "total";
export type BadgeTone = "ok" | "warn" | "danger" | "accent";

export const statusCopy: Record<MatchStatus, { label: string; tone: BadgeTone }> = {
  eligible: { label: "مؤهل", tone: "ok" },
  conditional: { label: "مشروط", tone: "warn" },
  ineligible: { label: "غير مؤهل", tone: "danger" },
  policy_review: { label: "مراجعة سياسة", tone: "accent" },
};

export const statusFilters: Array<{ key: "all" | MatchStatus; label: string }> = [
  { key: "all", label: "الكل" },
  { key: "eligible", label: "مؤهل" },
  { key: "conditional", label: "مشروط" },
  { key: "ineligible", label: "غير مؤهل" },
];

export const structureFilters: Array<{ key: string; label: string }> = [
  { key: "all", label: "كل الهياكل" },
  { key: "tawarruq", label: "تورق" },
  { key: "murabaha", label: "مرابحة" },
  { key: "ijarah", label: "إجارة" },
];

export const sortOptions: Array<{ key: SortMode; label: string }> = [
  { key: "ranked", label: "ترتيب المحرك" },
  { key: "apr", label: "APR الأقل" },
  { key: "installment", label: "القسط الأقل" },
  { key: "total", label: "الإجمالي الأقل" },
];

export const applicationCandidateStatuses: MatchStatus[] = [
  "eligible",
  "conditional",
  "policy_review",
];

export const applicationProgressOrder = ["draft", "submitted", "under_review"];

export const agentLabels: Record<string, string> = {
  financial_profile: "الملف المالي",
  matching: "المطابقة",
  cost: "التكلفة",
  advisor: "المستشار",
  application: "التقديم",
};

export const eventLabels: Record<string, string> = {
  agent_started: "بدأ",
  tool_called: "أداة",
  finding: "نتيجة",
  agent_completed: "اكتمل",
  error: "خطأ",
  journey_completed: "انتهت الرحلة",
};

export const applicationStatusLabels: Record<string, string> = {
  draft: "مسودة",
  submitted: "مرسل",
  under_review: "تحت المراجعة",
  approved: "مقبول",
  declined: "مرفوض",
};

export const employmentLabels: Record<string, string> = {
  government: "حكومي",
  private: "قطاع خاص",
  military: "عسكري",
  retiree: "متقاعد",
  self_employed: "عمل حر",
};

export const structureLabels: Record<string, string> = {
  tawarruq: "تورق",
  murabaha: "مرابحة",
  ijarah: "إجارة",
};

export const confidenceLabels: Record<string, string> = {
  high: "عالية",
  medium: "متوسطة",
  low: "منخفضة",
};

export const trendLabels: Record<string, string> = {
  rising: "تصاعدي",
  falling: "تنازلي",
  stable: "مستقر",
  none: "لا توجد التزامات",
  unknown: "غير واضح",
};

export const unverifiedRateHint =
  "سعر مبدئي لم يُراجع بعد من الصفحة الرسمية للجهة — التفاصيل في صفحة كيف يعمل.";
