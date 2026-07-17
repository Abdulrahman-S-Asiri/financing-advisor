import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "../button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../dialog";

describe("shadcn smoke components", () => {
  it("renders button, card, and dialog primitives together", () => {
    render(
      <Dialog defaultOpen>
        <Card>
          <CardHeader>
            <CardTitle>Offer review</CardTitle>
            <CardDescription>Component surface smoke test</CardDescription>
          </CardHeader>
          <CardContent>
            <DialogTrigger asChild>
              <Button>Open detail</Button>
            </DialogTrigger>
          </CardContent>
        </Card>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog detail</DialogTitle>
            <DialogDescription>Rendered without a scratch route.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole("heading", { name: "Offer review" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open detail" })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dialog detail" })).toBeInTheDocument();
  });
});
