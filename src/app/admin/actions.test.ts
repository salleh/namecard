import { beforeEach, describe, expect, it, vi } from "vitest";
import { setCardDisabledAction } from "./actions";

const authMock = vi.fn();
const setCardDisabledMock = vi.fn();
const revalidatePathMock = vi.fn();
const logAdminAuditMock = vi.fn();

vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePathMock(p) }));
vi.mock("@/features/admin/adminRepository", () => ({
  setCardDisabled: (...args: unknown[]) => setCardDisabledMock(...args),
}));
vi.mock("@/features/admin/audit", () => ({
  logAdminAudit: (e: unknown) => logAdminAuditMock(e),
}));

const ADMIN_SESSION = {
  user: {
    isAdmin: true,
    entraObjectId: "oid-admin",
    emailSlug: "admin.user",
    email: "admin.user@example.com",
  },
};

function formWith(slug: string, disabled: boolean): FormData {
  const fd = new FormData();
  fd.set("slug", slug);
  fd.set("disabled", String(disabled));
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setCardDisabledAction", () => {
  it("performs no write and audits the denial for a non-admin", async () => {
    authMock.mockResolvedValueOnce({ user: { isAdmin: false, email: "mallory@example.com" } });

    await setCardDisabledAction(formWith("jane.tan", true));

    expect(setCardDisabledMock).not.toHaveBeenCalled();
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "access_denied", email: "mallory@example.com" }),
    );
  });

  it("performs no write for an unauthenticated caller", async () => {
    authMock.mockResolvedValueOnce(null);

    await setCardDisabledAction(formWith("jane.tan", true));

    expect(setCardDisabledMock).not.toHaveBeenCalled();
  });

  it("disables a card, audits the change, and revalidates for an admin", async () => {
    authMock.mockResolvedValueOnce(ADMIN_SESSION);
    setCardDisabledMock.mockResolvedValueOnce(1);

    await setCardDisabledAction(formWith("ahmad.zulkifli", true));

    expect(setCardDisabledMock).toHaveBeenCalledWith("ahmad.zulkifli", true);
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "card_disabled_changed",
        targetSlug: "ahmad.zulkifli",
        disabled: true,
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin");
    expect(revalidatePathMock).toHaveBeenCalledWith("/ahmad.zulkifli");
  });

  it("rejects an invalid slug without writing", async () => {
    authMock.mockResolvedValueOnce(ADMIN_SESSION);

    await setCardDisabledAction(formWith("../etc/passwd", true));

    expect(setCardDisabledMock).not.toHaveBeenCalled();
  });

  it("does not audit or revalidate when the slug no longer exists", async () => {
    authMock.mockResolvedValueOnce(ADMIN_SESSION);
    setCardDisabledMock.mockResolvedValueOnce(0);

    await setCardDisabledAction(formWith("ghost", true));

    expect(logAdminAuditMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rethrows a generic error when the database write fails", async () => {
    authMock.mockResolvedValueOnce(ADMIN_SESSION);
    setCardDisabledMock.mockRejectedValueOnce(new Error("db down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(setCardDisabledAction(formWith("jane.tan", true))).rejects.toThrow(
      /could not update/i,
    );
    errorSpy.mockRestore();
  });
});
