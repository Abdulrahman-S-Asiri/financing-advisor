// Typed API client. All calls go through the Next.js rewrite proxy
// (/backend/* -> BACKEND_URL), errors follow the backend's {"detail": string}
// convention, and every JSON response is validated with zod at this boundary.
import type { z } from "zod";

import {
  analyticsOverviewSchema,
  applicationRecordSchema,
  healthzSchema,
  journeyResponseSchema,
  offerVerificationSchema,
  openBankingStatusSchema,
  offerDetailResponseSchema,
  paymentScheduleResponseSchema,
  simulationResponseSchema,
} from "@/lib/schemas";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function detailFromResponse(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { detail?: unknown } | null;
  return typeof body?.detail === "string" ? body.detail : fallback;
}

export async function fetchJson<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
  init?: RequestInit,
  errorFallback = "تعذر الاتصال بالخادم.",
): Promise<z.infer<Schema>> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    throw new ApiError(await detailFromResponse(response, errorFallback), response.status);
  }
  return schema.parse(await response.json());
}

export function postStream(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export type JourneyConnectRequest = {
  persona_id: string;
  requested_amount: number;
  requested_tenor_months: number;
  age: number;
  nationality: "saudi" | string;
};

export type AdvisorChatRequest = {
  persona_id: string;
  journey_id: string;
  message: string;
};

export const api = {
  connectJourney: (body: JourneyConnectRequest) =>
    fetchJson("/backend/journey/connect", journeyResponseSchema, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  connectJourneyStream: (body: JourneyConnectRequest) =>
    postStream("/backend/journey/connect/stream", body),

  advisorChatStream: (body: AdvisorChatRequest) =>
    postStream("/backend/advisor/chat/stream", body),

  simulate: (body: {
    journey_id: string;
    requested_amount?: number;
    requested_tenor_months?: number;
    salary_transfer: boolean;
  }) =>
    fetchJson("/backend/advisor/tools/simulate", simulationResponseSchema, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  offerDetail: (journeyId: string, offerId: string) =>
    fetchJson(
      `/backend/advisor/tools/${journeyId}/offers/${offerId}`,
      offerDetailResponseSchema,
    ),

  paymentSchedule: (journeyId: string, offerId: string) =>
    fetchJson(
      `/backend/advisor/tools/${journeyId}/offers/${offerId}/payment-schedule`,
      paymentScheduleResponseSchema,
    ),

  healthz: () => fetchJson("/backend/healthz", healthzSchema),

  offerVerification: () =>
    fetchJson("/backend/offers/verification", offerVerificationSchema),

  openBankingStatus: () =>
    fetchJson("/backend/integrations/open-banking/status", openBankingStatusSchema),

  analyticsOverview: () =>
    fetchJson("/backend/analytics/overview", analyticsOverviewSchema),

  applicationDraft: (body: { journey_id: string; offer_id: string }) =>
    fetchJson("/backend/applications/draft", applicationRecordSchema, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  applicationAction: (applicationId: string, action: "submit" | "advance") =>
    fetchJson(`/backend/applications/${applicationId}/${action}`, applicationRecordSchema, {
      method: "POST",
    }),
};
