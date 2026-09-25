import { describe, expect, it } from "vitest";
import { getUserInitials, pickPrimaryMembership } from "../src/lib/user-profile";

describe("pickPrimaryMembership", () => {
  it("prefers the platform admin membership when multiple active memberships exist", () => {
    const memberships = [
      { role: "director", tenant_id: "tenant-1" },
      { role: "platform_admin", tenant_id: null },
    ];

    expect(pickPrimaryMembership(memberships)).toMatchObject({ role: "platform_admin", tenant_id: null });
  });

  it("falls back to the first membership when no platform admin entry exists", () => {
    const memberships = [
      { role: "director", tenant_id: "tenant-1" },
      { role: "accountant", tenant_id: "tenant-2" },
    ];

    expect(pickPrimaryMembership(memberships)).toMatchObject({ role: "director", tenant_id: "tenant-1" });
  });
});

describe("getUserInitials", () => {
  it("handles missing names without throwing", () => {
    expect(getUserInitials({ firstName: "", lastName: "" })).toBe("U");
    expect(getUserInitials({ firstName: null, lastName: null })).toBe("U");
    expect(getUserInitials({ firstName: "Claire", lastName: "Mboma" })).toBe("CM");
  });
});
