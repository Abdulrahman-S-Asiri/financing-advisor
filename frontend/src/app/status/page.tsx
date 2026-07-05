import type { Metadata } from "next";

import StatusDashboard from "../../components/status/StatusDashboard";

export const metadata: Metadata = {
  title: "حالة المنصة",
  description:
    "صفحة داخلية: صحة الخادم، نسبة التحقق من أسعار العروض، وحالة الإعدادات — دون أي قيم سرية.",
};

export default function StatusPage() {
  return <StatusDashboard />;
}
