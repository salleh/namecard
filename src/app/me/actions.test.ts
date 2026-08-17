import { beforeEach, describe, expect, it, vi } from "vitest";
import { EDITABLE_TEXT_FIELDS } from "@/features/card/editableFields";
import { refreshFromM365Action, updateMyCard, type EditActionState } from "./actions";

const authMock = vi.fn();
const updateOwnerCardMock = vi.fn();
const revalidatePathMock = vi.fn();
const getLockedFieldsMock = vi.fn();
const getAppGraphTokenMock = vi.fn();
const fetchGraphProfileByIdMock = vi.fn();

vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePathMock(p) }));
vi.mock("@/features/card/ownerRepository", () => ({
  updateOwnerCard: (...args: unknown[]) => updateOwnerCardMock(...args),
}));
vi.mock("@/features/card/fieldPolicyRepository", () => ({
  getLockedFields: () => getLockedFieldsMock(),
}));
// graphAppToken imports @/config/env (throws under jsdom); mock it so the module
// graph never loads env here. mapGraphProfileToVCardFields stays real (pure).
vi.mock("@/features/auth/graphAppToken", () => ({
  getAppGraphToken: () => getAppGraphTokenMock(),
}));
vi.mock("@/features/auth/graphAppClient", () => ({
  fetchGraphProfileById: (...args: unknown[]) => fetchGraphProfileByIdMock(...args),
}));

const IDLE: EditActionState = { status: "idle" };

function formFrom(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  for (const field of EDITABLE_TEXT_FIELDS) fd.set(field, "");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

const OWNER_SESSION = {
  user: { entraObjectId: "oid-jane", emailSlug: "jane.tan", isAdmin: false },
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: nothing locked, so existing update assertions see the full payload.
  getLockedFieldsMock.mockResolvedValue(new Set());
});

describe("updateMyCard", () => {
  it("rejects an unauthenticated caller and never touches the database", async () => {
    authMock.mockResolvedValueOnce(null);

    const result = await updateMyCard(IDLE, formFrom({ displayName: "Hacker" }));

    expect(result.status).toBe("error");
    expect(updateOwnerCardMock).not.toHaveBeenCalled();
  });

  it("persists using the Entra id from the session, not from form input", async () => {
    authMock.mockResolvedValueOnce(OWNER_SESSION);
    updateOwnerCardMock.mockResolvedValueOnce(undefined);

    // A malicious extra field trying to redirect the write must be ignored.
    const form = formFrom({ displayName: "Jane Tan", entraObjectId: "oid-attacker" });
    const result = await updateMyCard(IDLE, form);

    expect(result.status).toBe("success");
    expect(updateOwnerCardMock).toHaveBeenCalledOnce();
    const [entraObjectId, update] = updateOwnerCardMock.mock.calls[0]!;
    expect(entraObjectId).toBe("oid-jane");
    expect(update.fields.displayName).toBe("Jane Tan");
  });

  it("revalidates both the editor and the public card on success", async () => {
    authMock.mockResolvedValueOnce(OWNER_SESSION);
    updateOwnerCardMock.mockResolvedValueOnce(undefined);

    await updateMyCard(IDLE, formFrom({ displayName: "Jane" }));

    expect(revalidatePathMock).toHaveBeenCalledWith("/me");
    expect(revalidatePathMock).toHaveBeenCalledWith("/jane.tan");
  });

  it("returns field errors and does not persist when validation fails", async () => {
    authMock.mockResolvedValueOnce(OWNER_SESSION);

    const result = await updateMyCard(IDLE, formFrom({ email: "not-an-email" }));

    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.fieldErrors?.email).toBeTruthy();
    expect(updateOwnerCardMock).not.toHaveBeenCalled();
  });

  it("passes photo: null to the repository when removal is requested", async () => {
    authMock.mockResolvedValueOnce(OWNER_SESSION);
    updateOwnerCardMock.mockResolvedValueOnce(undefined);

    await updateMyCard(IDLE, formFrom({ removePhoto: "on" }));

    const [, update] = updateOwnerCardMock.mock.calls[0]!;
    expect(update.photo).toBeNull();
  });

  it("leaves photo untouched (omitted) when no photo change is requested", async () => {
    authMock.mockResolvedValueOnce(OWNER_SESSION);
    updateOwnerCardMock.mockResolvedValueOnce(undefined);

    await updateMyCard(IDLE, formFrom({ displayName: "Jane" }));

    const [, update] = updateOwnerCardMock.mock.calls[0]!;
    expect("photo" in update).toBe(false);
  });

  it("returns a generic error (and does not throw) when the database write fails", async () => {
    authMock.mockResolvedValueOnce(OWNER_SESSION);
    updateOwnerCardMock.mockRejectedValueOnce(new Error("db down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await updateMyCard(IDLE, formFrom({ displayName: "Jane" }));

    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.message).toMatch(/could not save/i);
    errorSpy.mockRestore();
  });

  it("drops an admin-locked field from the persisted update (server-side enforcement)", async () => {
    authMock.mockResolvedValueOnce(OWNER_SESSION);
    updateOwnerCardMock.mockResolvedValueOnce(undefined);
    getLockedFieldsMock.mockResolvedValueOnce(new Set(["jobTitle"]));

    // Even though the (crafted) form supplies jobTitle, the write must omit it.
    const result = await updateMyCard(IDLE, formFrom({ displayName: "Jane", jobTitle: "CEO" }));

    expect(result.status).toBe("success");
    const [, update] = updateOwnerCardMock.mock.calls[0]!;
    expect("jobTitle" in update.fields).toBe(false);
    expect(update.fields.displayName).toBe("Jane");
  });
});

describe("refreshFromM365Action", () => {
  it("rejects an unauthenticated caller and never calls Graph", async () => {
    authMock.mockResolvedValueOnce(null);

    const result = await refreshFromM365Action();

    expect(result.status).toBe("error");
    expect(getAppGraphTokenMock).not.toHaveBeenCalled();
    expect(fetchGraphProfileByIdMock).not.toHaveBeenCalled();
  });

  it("returns the mapped profile fields for the session's own Entra id (no persist)", async () => {
    authMock.mockResolvedValueOnce(OWNER_SESSION);
    getAppGraphTokenMock.mockResolvedValueOnce("app-token");
    fetchGraphProfileByIdMock.mockResolvedValueOnce({
      id: "oid-jane",
      displayName: "Jane Tan",
      jobTitle: "Engineer",
      businessPhones: ["03-1234"],
    });

    const result = await refreshFromM365Action();

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.fields.displayName).toBe("Jane Tan");
    expect(result.fields.jobTitle).toBe("Engineer");
    expect(result.fields.businessPhone).toBe("03-1234");
    expect(fetchGraphProfileByIdMock).toHaveBeenCalledWith("oid-jane", "app-token");
    // Refresh must never persist — that is the owner's job via Save.
    expect(updateOwnerCardMock).not.toHaveBeenCalled();
  });

  it("returns a generic error (and does not throw) when the Graph fetch fails", async () => {
    authMock.mockResolvedValueOnce(OWNER_SESSION);
    getAppGraphTokenMock.mockResolvedValueOnce("app-token");
    fetchGraphProfileByIdMock.mockRejectedValueOnce(new Error("graph 403"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await refreshFromM365Action();

    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.message).toMatch(/microsoft 365/i);
    errorSpy.mockRestore();
  });
});
