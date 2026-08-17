import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { org } from "@/config/org";
import HomePage from "./page";

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// HomePage embeds the client LookupForm, which reads useRouter().
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// HomePage → SignOutButton → logoutActions (a server action) imports @/config/env,
// whose client guard throws under jsdom. Stub the actions so the real SignOutButton
// still renders (the "Sign out" assertion below exercises it) without pulling in env.
vi.mock("@/features/auth/logoutActions", () => ({
  signOutApp: vi.fn(),
  signOutMicrosoft: vi.fn(),
}));

describe("HomePage", () => {
  it("always renders the app name heading", async () => {
    authMock.mockResolvedValueOnce(null);

    render(await HomePage());

    expect(screen.getByRole("heading", { name: org.appName })).toBeInTheDocument();
  });

  it("renders the public card lookup form", async () => {
    authMock.mockResolvedValueOnce(null);

    render(await HomePage());

    expect(screen.getByLabelText("Find a staff namecard")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show card" })).toBeInTheDocument();
  });

  it("shows a sign-in control when signed out", async () => {
    authMock.mockResolvedValueOnce(null);

    render(await HomePage());

    expect(screen.getByRole("button", { name: "Sign in to manage your card" })).toBeInTheDocument();
  });

  it("shows sign-out, the user's email, and a manage link when signed in", async () => {
    authMock.mockResolvedValueOnce({
      user: { email: "jane.tan@example.com", isAdmin: false },
    });

    render(await HomePage());

    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByText(/jane\.tan@example\.com/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage my card" })).toBeInTheDocument();
  });
});
