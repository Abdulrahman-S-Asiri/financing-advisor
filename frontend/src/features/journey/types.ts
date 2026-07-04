export type StageKey = "discover" | "define" | "develop" | "deliver";
export type MatchStatus = "eligible" | "conditional" | "ineligible" | "policy_review";
export type SortMode = "ranked" | "apr" | "installment" | "total";

export type Persona = {
  id: string;
  name: string;
  label: string;
  summary: string;
  amount: number;
  tenor: number;
  age: number;
};

export type FinancialProfile = {
  persona_id: string;
  gross_salary: number;
  other_monthly_income_avg: number;
  employment_type: string;
  is_retiree: boolean;
  age: number;
  nationality: string;
  salary_linked_obligations: number;
  other_obligations: number;
  real_estate_obligations: number;
  months_observed: number;
  salary_bank: string;
  salary_stability_score: number;
  obligation_trend: string;
  confidence_level: string;
  detection_notes: string[];
  total_monthly_income: number;
};

export type AgentEvent = {
  journey_id: string;
  sequence: number;
  type: string;
  agent: string | null;
  message_ar: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type NearMissSuggestion = {
  kind: string;
  message: string;
  requested_amount: number | null;
  requested_tenor_months: number | null;
  monthly_installment: number | null;
  status: MatchStatus | null;
};

export type PaymentScheduleRow = {
  month: number;
  installment: number;
  principal_component: number;
  profit_component: number;
  remaining_principal: number;
};

export type CostBreakdown = {
  principal: number;
  tenor_months: number;
  flat_rate_annual: number;
  monthly_installment: number;
  total_profit: number;
  admin_fee: number;
  total_amount_payable: number;
  apr_effective: number;
};

export type DbrDecision = {
  passes: boolean;
  tier: string;
  salary_linked_ratio: number;
  non_real_estate_ratio: number;
  total_ratio: number;
  salary_linked_cap: number;
  non_real_estate_cap: number | null;
  total_cap: number | null;
  breaches: string[];
  policy_review: boolean;
};

export type FinancialHealth = {
  tier: string;
  salary_linked_ratio: number;
  non_real_estate_ratio: number;
  total_ratio: number;
  salary_linked_cap: number;
  non_real_estate_cap: number | null;
  total_cap: number | null;
  policy_review: boolean;
  breaches: string[];
  max_affordable_new_installment: number;
  monthly_obligations: number;
};

export type OfferMatch = {
  offer_id: string;
  institution: string;
  product: string;
  category?: string;
  structure: string;
  status: MatchStatus;
  monthly_installment: number | null;
  apr_effective: number | null;
  total_amount_payable: number | null;
  cost_breakdown?: CostBreakdown | null;
  dbr?: DbrDecision | null;
  payment_schedule_months: number;
  reasons: string[];
  conditions: string[];
  rate_verified: boolean;
  source_url?: string;
  retrieved_at?: string;
  near_miss_suggestions: NearMissSuggestion[];
};

export type JourneyResponse = {
  journey_id: string;
  profile: FinancialProfile;
  max_affordable_new_installment: number;
  financial_health: FinancialHealth;
  matches: OfferMatch[];
  events: AgentEvent[];
  suggested_questions: string[];
};

export type SimulationResponse = {
  requested_amount: number;
  requested_tenor_months: number;
  salary_transfer: boolean;
  max_affordable_new_installment: number;
  matches: OfferMatch[];
};

export type ChatMessage = {
  role: "user" | "advisor";
  text: string;
};

export type SseEvent<T> = {
  event: string;
  id?: string;
  retry?: string;
  data: T;
};

export type ChatStreamPayload = {
  delta?: string;
  reply?: string;
  detail?: string;
};

export type ApplicationHistoryItem = {
  status: string;
  message_ar: string;
  created_at: string;
};

export type ApplicationRecord = {
  application_id: string;
  journey_id: string;
  offer_id: string;
  status: string;
  summary: {
    institution: string;
    product: string;
    monthly_installment: number | null;
    total_amount_payable: number | null;
    simulation_notice_ar: string;
  };
  history: ApplicationHistoryItem[];
  simulation: boolean;
};
