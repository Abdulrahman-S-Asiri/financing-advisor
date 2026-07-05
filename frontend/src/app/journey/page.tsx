import type { Metadata } from "next";

import JourneyApp from "../../features/journey/JourneyApp";

export const metadata: Metadata = {
  title: "رحلة التمويل",
  description:
    "رحلة قرار التمويل: ربط بيانات محاكاة، تحليل الملف المالي، ومقارنة العروض بأسباب واضحة.",
};

export default async function JourneyPage({
  searchParams,
}: {
  searchParams: Promise<{ persona?: string }>;
}) {
  const { persona } = await searchParams;
  return <JourneyApp initialPersonaId={persona} />;
}
