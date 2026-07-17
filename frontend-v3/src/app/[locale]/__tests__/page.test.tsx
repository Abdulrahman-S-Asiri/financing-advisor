import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "../page";

describe("Home", () => {
  it("renders the English landing copy from locale messages", async () => {
    render(await Home({ params: Promise.resolve({ locale: "en" }) }));

    expect(
      screen.getByRole("heading", {
        name: /your financing decision, calculated and explained in arabic/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/simulated banking data/i)).toBeInTheDocument();
  });

  it("renders the Arabic landing copy from locale messages", async () => {
    render(await Home({ params: Promise.resolve({ locale: "ar" }) }));

    expect(
      screen.getByRole("heading", { name: "قرار تمويلك، محسوب ومُفسَّر بالعربية" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/بيانات مصرفية محاكاة/)).toBeInTheDocument();
  });
});
