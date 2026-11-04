import { describe, expect, it } from "vitest";
import { errorMessage, safeErrorSummary } from "./app-errors";

describe("safe error handling", () => {
  it("does not reveal provider payloads or credentials", () => {
    const secret = "private-password-token";
    expect(errorMessage(new Error(`SQL failure: ${secret}`))).not.toContain(secret);
    expect(safeErrorSummary(new Error(secret))).not.toContain(secret);
  });
  it("explains tenant permission failures", () => {
    expect(errorMessage({ code: "42501" })).toBe("Vous n’avez pas les droits nécessaires dans cet établissement.");
  });
  it("distinguishes duplicate values and expired sessions", () => {
    expect(errorMessage({ code: "23505" })).toContain("existe déjà");
    expect(errorMessage({ status: 401 })).toContain("Reconnectez-vous");
  });
});