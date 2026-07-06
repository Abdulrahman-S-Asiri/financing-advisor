import type { Metadata } from "next";

import { OfferDetailPage } from "@/components/journey/OfferDetailPage";
import { strings } from "@/lib/strings";

export const metadata: Metadata = {
  title: strings.detail.metaTitle,
};

export default async function JourneyOfferDetailRoute({
  params,
}: {
  params: Promise<{ journeyId: string; offerId: string }>;
}) {
  const { journeyId, offerId } = await params;
  return <OfferDetailPage journeyId={journeyId} offerId={offerId} />;
}
