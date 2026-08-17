import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mutable status the mocked useFormStatus returns, so a single module mock can
// drive both the idle and pending cases (vi.mock is hoisted once per file).
const status = { pending: false };
vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  useFormStatus: () => status,
}));

import { SubmitButton } from "./SubmitButton";

beforeEach(() => {
  status.pending = false;
});

describe("SubmitButton", () => {
  it("renders its children and is enabled while the form is idle", () => {
    render(<SubmitButton className="btn">Save changes</SubmitButton>);

    const button = screen.getByRole("button", { name: "Save changes" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveAttribute("aria-busy", "false");
    expect(button).toHaveClass("btn");
  });

  it("disables itself and shows the pending label while the action is in flight", () => {
    status.pending = true;
    render(<SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>);

    const button = screen.getByRole("button", { name: "Saving…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Save changes")).not.toBeInTheDocument();
  });

  it("falls back to a default pending label when none is given", () => {
    status.pending = true;
    render(<SubmitButton>Enable</SubmitButton>);

    expect(screen.getByRole("button", { name: "Working…" })).toBeInTheDocument();
  });
});
