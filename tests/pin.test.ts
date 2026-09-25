import { describe, expect, it } from "vitest";

import {
  hashPin,
  hashPinSetupToken,
  verifyPin,
  verifyPinSetupToken,
} from "../lib/pin";

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

  it("supports a high-entropy setup token for deferred PIN creation", async () => {
    const token = "a-secure-one-time-setup-token-with-more-than-32-characters";
    const hash = await hashPinSetupToken(token);

    await expect(verifyPinSetupToken(token, hash)).resolves.toBe(true);
    await expect(verifyPinSetupToken("wrong-token-with-more-than-32-characters", hash)).resolves.toBe(false);
    await expect(verifyPin(token, hash)).resolves.toBe(false);
  });

  it("rejects an incorrect PIN and malformed hashes", async () => {
    const hash = await hashPin("4827");

    await expect(verifyPin("1111", hash)).resolves.toBe(false);
    await expect(verifyPin("4827", "not-a-valid-hash")).resolves.toBe(false);
  });

  it("rejects PIN values that are not exactly 4 digits", async () => {
    await expect(hashPin("123")).rejects.toThrow("exactly 4 digits");
    await expect(hashPin("12345")).rejects.toThrow("exactly 4 digits");
    await expect(hashPin("12a4")).rejects.toThrow("exactly 4 digits");
  });
});
