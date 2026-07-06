import type { Metadata } from "next";

import { JourneyDecisionPage } from "@/components/journey/JourneyDecisionPage";
import { strings } from "@/lib/strings";

export const metadata: Metadata = {
  title: strings.decision.metaTitle,
};

export default function DecisionPage() {
  return <JourneyDecisionPage />;
}
