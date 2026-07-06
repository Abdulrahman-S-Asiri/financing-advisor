import type { Metadata } from "next";

import { JourneyStartPage } from "@/components/journey/JourneyStartPage";
import { strings } from "@/lib/strings";

export const metadata: Metadata = {
  title: strings.nav.journey,
};

export default async function JourneyPage({
  searchParams,
}: {
  searchParams?: Promise<{ persona?: string | string[] }>;
}) {
  const resolved = await searchParams;
  const persona = Array.isArray(resolved?.persona)
    ? resolved?.persona[0]
    : resolved?.persona;

  return <JourneyStartPage initialPersonaId={persona} />;
}
