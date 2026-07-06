import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DebtPaymentPage } from "@/components/debt/DebtPaymentPage";
import { strings } from "@/lib/strings";

describe("DebtPaymentPage", () => {
  it("renders the coming-soon explainer with no payment action", () => {
    render(<DebtPaymentPage />);

    expect(screen.getByRole("heading", { name: strings.debtPayment.title })).toBeInTheDocument();
    expect(screen.getByText(strings.debtPayment.noPaymentAction)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: strings.debtPayment.cta })).toHaveAttribute(
      "href",
      "/journey",
    );
    expect(screen.getByRole("link", { name: strings.nav.docs })).toHaveAttribute(
      "href",
      "/docs",
    );
  });

  it("lets the user select mock obligations and guide stages only", () => {
    render(<DebtPaymentPage />);

    const secondObligation = screen.getByRole("button", {
      name: strings.debtPayment.obligations[1],
    });
    fireEvent.click(secondObligation);
    expect(secondObligation).toHaveAttribute("aria-pressed", "true");

    const thirdStage = screen.getByRole("button", {
      name: new RegExp(strings.debtPayment.stages[2]),
    });
    fireEvent.click(thirdStage);
    expect(thirdStage).toHaveAttribute("aria-pressed", "true");
  });
});
