import { describe, expect, it } from "vitest";
import { inactivityExpired, inactivityMinutes } from "./inactivity";
describe("inactivity expiry", () => {
  it("uses the safe default for invalid configurations", () => {
    for (const value of [null, 0, -1, 481, 2.5, "30"]) expect(inactivityMinutes(value)).toBe(30);
  });
  it("expires exactly at the configured inactivity deadline", () => {
    expect(inactivityExpired(1000, 1000 + 5 * 60_000 - 1, 5)).toBe(false);
    expect(inactivityExpired(1000, 1000 + 5 * 60_000, 5)).toBe(true);
    expect(inactivityExpired(1000, 1000 + 5 * 60_000, 60)).toBe(false);
  });
});