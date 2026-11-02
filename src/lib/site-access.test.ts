import { describe, expect, it } from "vitest";
import { assertSiteAssignments, assertWholeAccountScope, rolesForSite } from "./site-access";

describe("strict establishment isolation", () => {
  const rows = [{ etablissement_id: "A", role: "super_admin" }, { etablissement_id: "B", role: "technicien" }];
  it("does not carry super admin rights to another site", () => {
    expect(rolesForSite(rows, "B")).toEqual(["technicien"]);
    expect(rolesForSite(rows, null)).toEqual([]);
  });
  it("rejects an assignment outside managed sites even for a super admin", () => {
    expect(() => assertSiteAssignments([{ etablissement_id: "B", role: "technicien" }], new Map([["A", true]]))).toThrow();
  });
  it("does not allow restricted admins to grant super admin", () => {
    expect(() => assertSiteAssignments([{ etablissement_id: "A", role: "super_admin" }], new Map([["A", false]]))).toThrow();
  });
  it("allows different roles on authorized sites", () => {
    expect(() => assertSiteAssignments(rows, new Map([["A", true], ["B", false]]))).not.toThrow();
  });
  it("blocks account-wide actions when another site is outside the caller scope", () => {
    expect(() => assertWholeAccountScope(["A", "B"], new Map([["A", true]]))).toThrow();
  });
});