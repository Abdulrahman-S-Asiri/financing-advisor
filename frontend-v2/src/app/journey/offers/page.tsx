import type { Metadata } from "next";

import { JourneyOffersPage } from "@/components/journey/JourneyOffersPage";
import { strings } from "@/lib/strings";

export const metadata: Metadata = {
  title: strings.offers.metaTitle,
};

export default function OffersPage() {
  return <JourneyOffersPage />;
}
