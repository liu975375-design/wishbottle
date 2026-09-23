import { describe, expect, it } from "vitest";

import {
  normalizeWishCode,
  validateCreateWishInput,
  validateFindWishInput,
} from "../lib/validation";

describe("Wish validation", () => {
  it("trims Wish content before saving", () => {
    const result = validateCreateWishInput({
      wishContent: "  A peaceful year  ",
      pin: "4827",
      confirmPin: "4827",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        wishContent: "A peaceful year",
        pin: "4827",
      },
    });
  });

  it("rejects empty or whitespace-only Wish content", () => {
    expect(
      validateCreateWishInput({
        wishContent: "   ",
        pin: "4827",
        confirmPin: "4827",
      }),
    ).toEqual({ ok: false, error: "Wish cannot be empty." });
  });

  it("requires a 4 to 6 digit PIN", () => {
    expect(
      validateCreateWishInput({
        wishContent: "A wish",
        pin: "123",
        confirmPin: "123",
      }),
    ).toEqual({ ok: false, error: "PIN must be 4 to 6 digits." });
  });

  it("requires both PIN values to match", () => {
    expect(
      validateCreateWishInput({
        wishContent: "A wish",
        pin: "4827",
        confirmPin: "4828",
      }),
    ).toEqual({ ok: false, error: "PIN and Confirm PIN must match." });
  });

  it("normalizes a Wish Code for lookup", () => {
    const result = validateFindWishInput({
      wishCode: "  maple-4827  ",
      pin: "4827",
    });

    expect(normalizeWishCode("  maple-4827  ")).toBe("MAPLE-4827");
    expect(result).toEqual({
      ok: true,
      data: {
        wishCode: "MAPLE-4827",
        pin: "4827",
      },
    });
  });
});
