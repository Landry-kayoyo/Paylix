import { describe, expect, it } from "vitest";
import { validateLocalPhoneForCountry, validatePhoneNumber } from "../src/app/school/parents/phone-utils";

describe("validateLocalPhoneForCountry", () => {
  it("accepts a strict 9-digit number for the DR Congo", () => {
    expect(validateLocalPhoneForCountry("CD", "812345678")).toBe(true);
  });

  it("rejects shorter or longer numbers", () => {
    expect(validateLocalPhoneForCountry("CD", "81234567")).toBe(false);
    expect(validateLocalPhoneForCountry("CD", "8123456789")).toBe(false);
  });

  it("rejects non-digit characters", () => {
    expect(validateLocalPhoneForCountry("CD", "81 234 5678")).toBe(false);
  });
});

describe("validatePhoneNumber", () => {
  it("accepts a valid international DR Congo number", () => {
    expect(validatePhoneNumber("+243812345678")).toBe(true);
  });
});
