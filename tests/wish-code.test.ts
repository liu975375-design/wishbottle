import { describe, expect, it } from "vitest";

import {
  generateWishCodeBase,
  wishCodeForAttempt,
} from "../lib/wish-code";

const SEPTEMBER_22 = new Date(2026, 8, 22, 12, 0, 0);
const SEPTEMBER_23 = new Date(2026, 8, 23, 12, 0, 0);

describe("Wish Code generation", () => {
  it("uses the normalized name and DDMMYYYY creation date", () => {
    expect(generateWishCodeBase("Mary", SEPTEMBER_22)).toBe("MARY22092026");
  });

  it("removes spaces from a multi-part name", () => {
    expect(generateWishCodeBase("Alex Smith", SEPTEMBER_22)).toBe(
      "ALEXSMITH22092026",
    );
  });

  it("increments collision suffixes in order", () => {
    const baseCode = generateWishCodeBase("Mary", SEPTEMBER_22);

    expect(wishCodeForAttempt(baseCode, 1)).toBe("MARY22092026");
    expect(wishCodeForAttempt(baseCode, 2)).toBe("MARY22092026-2");
    expect(wishCodeForAttempt(baseCode, 3)).toBe("MARY22092026-3");
  });

  it("uses the creation date, not the reminder date", () => {
    expect(generateWishCodeBase("Mary", SEPTEMBER_22)).toBe("MARY22092026");
    expect(generateWishCodeBase("Mary", SEPTEMBER_23)).toBe("MARY23092026");
  });

  it("trims surrounding spaces before building the base code", () => {
    expect(generateWishCodeBase(" Mary ", SEPTEMBER_22)).toBe(
      "MARY22092026",
    );
  });

  it("rejects names that contain no letters or numbers", () => {
    expect(() => generateWishCodeBase("  !!!  ", SEPTEMBER_22)).toThrow(
      "Name must contain letters or numbers",
    );
  });
});
