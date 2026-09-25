import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  isValidEmail,
  normalizeWishCode,
  validateCreateWishInput,
  validateFindWishInput,
} from "../lib/validation";

describe("Wish validation", () => {
  it("validates email addresses with the shared email rule", () => {
    expect(isValidEmail("john@example.com")).toBe(true);
    expect(isValidEmail("john@example")).toBe(false);
    expect(isValidEmail("not an email")).toBe(false);
  });

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

  it("allows a wish to be saved before the PIN is chosen", () => {
    expect(
      validateCreateWishInput({
        wishContent: "A wish",
      }),
    ).toEqual({
      ok: true,
      data: {
        wishContent: "A wish",
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

  it("accepts 80 characters and rejects 81 characters", () => {
    expect(
      validateCreateWishInput({
        wishContent: "a".repeat(80),
      }),
    ).toMatchObject({ ok: true });

    expect(
      validateCreateWishInput({
        wishContent: "a".repeat(81),
      }),
    ).toEqual({
      ok: false,
      error: "Wish must be 80 characters or fewer.",
    });
  });

  it("requires an exact 4 digit PIN", () => {
    expect(
      validateCreateWishInput({
        wishContent: "A wish",
        pin: "123",
        confirmPin: "123",
      }),
    ).toEqual({ ok: false, error: "PIN must be exactly 4 digits." });
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

  it("keeps the database Original Wish limit aligned with the API", () => {
    const migration = readFileSync(
      "supabase/migrations/20260925000000_add_original_wish_length_check.sql",
      "utf8",
    );

    expect(migration).toMatch(/char_length\(wish_content\) <= 80/i);
    expect(migration).toMatch(/not valid/i);
  });
});
