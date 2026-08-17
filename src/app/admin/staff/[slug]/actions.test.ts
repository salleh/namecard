import { beforeEach, describe, expect, it, vi } from "vitest";
import { EDITABLE_TEXT_FIELDS } from "@/features/card/editableFields";
import {
  adminFetchFromM365Action,
  updateStaffCardByAdminAction,
  type AdminEditActionState,
} from "./actions";

const authMock = vi.fn();
const revalidatePathMock = vi.fn();
const getEntraObjectIdBySlugMock = vi.fn();
const updateStaffCardByAdminMock = vi.fn();
const logAdminAuditMock = vi.fn();
const getAppGraphTokenMock = vi.fn();
const fetchGraphProfileByIdMock = vi.fn();

vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePathMock(p) }));
vi.mock("@/features/admin/adminRepository", () => ({
  getEntraObjectIdBySlug: (...a: unknown[]) => getEntraObjectIdBySlugMock(...a),
  updateStaffCardByAdmin: (...a: unknown[]) => updateStaffCardByAdminMock(...a),
}));
vi.mock("@/features/admin/audit", () => ({
  logAdminAudit: (...a: unknown[]) => logAdminAuditMock(...a),
}));
// graphAppToken imports @/config/env (throws under jsdom); mock it so env never
// loads here. mapGraphProfileToVCardFields stays real (pure).
vi.mock("@/features/auth/graphAppToken", () => ({
  getAppGraphToken: () => getAppGraphTokenMock(),
}));
vi.mock("@/features/auth/graphAppClient", () => ({
  fetchGraphProfileById: (...a: unknown[]) => fetchGraphProfileByIdMock(...a),
}));

const IDLE: AdminEditActionState = { status: "idle" };

const ADMIN_SESSION = {
  user: {
    isAdmin: true,
    entraObjectId: "oid-admin",
    emailSlug: "admin.user",
    email: "admin.user@example.com",
  },
};
const NON_ADMIN_SESSION = {
  user: { isAdmin: false, entraObjectId: "oid-jane", emailSlug: "jane.tan", email: "j@x.my" },
};

function editForm(slug: string, overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("slug", slug);
  for (const field of EDITABLE_TEXT_FIELDS) fd.set(field, "");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("adminFetchFromM365Action — authorization & containment", () => {
  it("denies a non-admin, audits it, and never calls Graph", async () => {
    authMock.mockResolvedValueOnce(NON_ADMIN_SESSION);

    const result = await adminFetchFromM365Action("jane.tan");

    expect(result.status).toBe("error");
    expect(getEntraObjectIdBySlugMock).not.toHaveBeenCalled();
    expect(getAppGraphTokenMock).not.toHaveBeenCalled();
    expect(fetchGraphProfileByIdMock).not.toHaveBeenCalled();
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "access_denied" }),
    );
  });

  it("refuses a slug that is not an onboarded staff member (no Graph call)", async () => {
    authMock.mockResolvedValueOnce(ADMIN_SESSION);
    getEntraObjectIdBySlugMock.mockResolvedValueOnce(null); // unknown slug → no id

    const result = await adminFetchFromM365Action("someone.random");

    expect(result.status).toBe("error");
    // Containment: the tenant-wide Graph permission is never exercised for a
    // slug that isn't in our database.
    expect(getAppGraphTokenMock).not.toHaveBeenCalled();
    expect(fetchGraphProfileByIdMock).not.toHaveBeenCalled();
  });

  it("resolves the id from OUR db (not the client) and fetches only that id", async () => {
    authMock.mockResolvedValueOnce(ADMIN_SESSION);
    getEntraObjectIdBySlugMock.mockResolvedValueOnce("oid-jane-from-db");
    getAppGraphTokenMock.mockResolvedValueOnce("app-token");
    fetchGraphProfileByIdMock.mockResolvedValueOnce({
      id: "oid-jane-from-db",
      displayName: "Jane",
    });

    const result = await adminFetchFromM365Action("jane.tan");

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.fields.displayName).toBe("Jane");
    // The id passed to Graph is the DB-resolved one, never client input.
    expect(fetchGraphProfileByIdMock).toHaveBeenCalledWith("oid-jane-from-db", "app-token");
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "admin_m365_fetch", targetSlug: "jane.tan" }),
    );
  });

  it("rejects a malformed slug before any lookup", async () => {
    authMock.mockResolvedValueOnce(ADMIN_SESSION);

    const result = await adminFetchFromM365Action("../../etc/passwd");

    expect(result.status).toBe("error");
    expect(getEntraObjectIdBySlugMock).not.toHaveBeenCalled();
  });

  it("returns a generic error (no throw) when Graph fails", async () => {
    authMock.mockResolvedValueOnce(ADMIN_SESSION);
    getEntraObjectIdBySlugMock.mockResolvedValueOnce("oid-jane");
    getAppGraphTokenMock.mockResolvedValueOnce("app-token");
    fetchGraphProfileByIdMock.mockRejectedValueOnce(new Error("graph 403"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await adminFetchFromM365Action("jane.tan");

    expect(result.status).toBe("error");
    errorSpy.mockRestore();
  });
});

describe("updateStaffCardByAdminAction — authorization", () => {
  it("denies a non-admin, audits it, and never writes", async () => {
    authMock.mockResolvedValueOnce(NON_ADMIN_SESSION);

    const result = await updateStaffCardByAdminAction(
      IDLE,
      editForm("jane.tan", { displayName: "X" }),
    );

    expect(result.status).toBe("error");
    expect(updateStaffCardByAdminMock).not.toHaveBeenCalled();
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "access_denied" }),
    );
  });

  it("persists an admin edit keyed on the slug, audits it, and revalidates", async () => {
    authMock.mockResolvedValueOnce(ADMIN_SESSION);
    updateStaffCardByAdminMock.mockResolvedValueOnce(1);

    const result = await updateStaffCardByAdminAction(
      IDLE,
      editForm("jane.tan", { displayName: "Jane Tan" }),
    );

    expect(result.status).toBe("success");
    const [slug, update] = updateStaffCardByAdminMock.mock.calls[0]!;
    expect(slug).toBe("jane.tan");
    expect(update.fields.displayName).toBe("Jane Tan");
    expect(logAdminAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "admin_card_edited", targetSlug: "jane.tan" }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/staff/jane.tan");
    expect(revalidatePathMock).toHaveBeenCalledWith("/jane.tan");
  });

  it("returns a not-found error when the slug no longer exists (0 rows)", async () => {
    authMock.mockResolvedValueOnce(ADMIN_SESSION);
    updateStaffCardByAdminMock.mockResolvedValueOnce(0);

    const result = await updateStaffCardByAdminAction(
      IDLE,
      editForm("ghost", { displayName: "X" }),
    );

    expect(result.status).toBe("error");
  });
});
