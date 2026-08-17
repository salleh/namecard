import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LookupForm } from "./LookupForm";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("LookupForm", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("routes to the staff card for a bare email name", async () => {
    const user = userEvent.setup();
    render(<LookupForm />);

    await user.type(screen.getByLabelText("Find a staff namecard"), "jane.tan");
    await user.click(screen.getByRole("button", { name: "Show card" }));

    expect(pushMock).toHaveBeenCalledWith("/jane.tan");
  });

  it("strips a full staff email before routing", async () => {
    const user = userEvent.setup();
    render(<LookupForm />);

    await user.type(screen.getByLabelText("Find a staff namecard"), "Jane.Tan@example.com");
    await user.click(screen.getByRole("button", { name: "Show card" }));

    expect(pushMock).toHaveBeenCalledWith("/jane.tan");
  });

  it("shows an error and does not route for invalid input", async () => {
    const user = userEvent.setup();
    render(<LookupForm />);

    await user.type(screen.getByLabelText("Find a staff namecard"), "jane tan");
    await user.click(screen.getByRole("button", { name: "Show card" }));

    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/valid staff email name/i);
  });

  it("clears the error once the user edits the field again", async () => {
    const user = userEvent.setup();
    render(<LookupForm />);

    const input = screen.getByLabelText("Find a staff namecard");
    await user.type(input, "jane tan");
    await user.click(screen.getByRole("button", { name: "Show card" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await user.type(input, "x");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
