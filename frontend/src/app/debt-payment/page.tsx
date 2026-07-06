import type { Metadata } from "next";

import { DebtPaymentPage } from "@/components/debt/DebtPaymentPage";
import { strings } from "@/lib/strings";

export const metadata: Metadata = {
  title: strings.debtPayment.metaTitle,
};

export default function DebtPaymentRoute() {
  return <DebtPaymentPage />;
}
