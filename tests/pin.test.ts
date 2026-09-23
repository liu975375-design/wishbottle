import { describe, expect, it } from "vitest";

import { hashPin, verifyPin } from "../lib/pin";

describe("PIN hashing", () => {
  it("hashes a valid PIN and verifies it", async () => {
    const hash = await hashPin("4827");

    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toBe("4827");
    await expect(verifyPin("4827", hash)).resolves.toBe(true);
  });

  it("uses a random salt for each hash", async () => {
    const firstHash = await hashPin("4827");
    const secondHash = await hashPin("4827");

    expect(firstHash).not.toBe(secondHash);
    await expect(verifyPin("4827", firstHash)).resolves.toBe(true);
    await expect(verifyPin("4827", secondHash)).resolves.toBe(true);
  });

  it("rejects an incorrect PIN and malformed hashes", async () => {
    const hash = await hashPin("4827");

    await expect(verifyPin("1111", hash)).resolves.toBe(false);
    await expect(verifyPin("4827", "not-a-valid-hash")).resolves.toBe(false);
  });

  it("rejects PIN values outside 4 to 6 digits", async () => {
    await expect(hashPin("123")).rejects.toThrow("4 to 6 digits");
    await expect(hashPin("1234567")).rejects.toThrow("4 to 6 digits");
    await expect(hashPin("12a4")).rejects.toThrow("4 to 6 digits");
  });
});
