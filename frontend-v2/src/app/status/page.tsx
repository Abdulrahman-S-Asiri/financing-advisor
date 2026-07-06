import type { Metadata } from "next";

import { StatusDashboard } from "@/components/status/StatusDashboard";
import { strings } from "@/lib/strings";

export const metadata: Metadata = {
  title: strings.status.metaTitle,
};

export default function StatusPage() {
  return <StatusDashboard />;
}
