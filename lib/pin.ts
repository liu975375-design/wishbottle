import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

import { isValidPin } from "./validation";

const SCRYPT_PARAMETERS = {
  N: 32768,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
} as const;

const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

type ScryptOptions = {
  N: number;
  r: number;
  p: number;
  maxmem: number;
};

function deriveKey(
  pin: string,
  salt: Buffer,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(pin, salt, KEY_LENGTH, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

export async function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) {
    throw new Error("PIN must be 4 to 6 digits.");
  }

  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await deriveKey(pin, salt, SCRYPT_PARAMETERS);

  return [
    "scrypt",
    SCRYPT_PARAMETERS.N,
    SCRYPT_PARAMETERS.r,
    SCRYPT_PARAMETERS.p,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

export async function verifyPin(
  pin: string,
  encodedHash: string,
): Promise<boolean> {
  if (!isValidPin(pin)) {
    return false;
  }

  const parts = encodedHash.split("$");

  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);

  if (
    !Number.isSafeInteger(N) ||
    !Number.isSafeInteger(r) ||
    !Number.isSafeInteger(p) ||
    N <= 1 ||
    r <= 0 ||
    p <= 0 ||
    N > 131072 ||
    r > 32 ||
    p > 4
  ) {
    return false;
  }

  try {
    const salt = Buffer.from(parts[4], "base64url");
    const storedKey = Buffer.from(parts[5], "base64url");

    if (salt.length !== SALT_LENGTH || storedKey.length !== KEY_LENGTH) {
      return false;
    }

    const derivedKey = await deriveKey(pin, salt, {
      N,
      r,
      p,
      maxmem: SCRYPT_PARAMETERS.maxmem,
    });

    return timingSafeEqual(storedKey, derivedKey);
  } catch {
    return false;
  }
}
