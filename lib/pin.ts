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

async function hashCredential(secret: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await deriveKey(secret, salt, SCRYPT_PARAMETERS);

  return [
    "scrypt",
    SCRYPT_PARAMETERS.N,
    SCRYPT_PARAMETERS.r,
    SCRYPT_PARAMETERS.p,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

export async function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) {
    throw new Error("PIN must be exactly 4 digits.");
  }

  return hashCredential(pin);
}

export async function hashPinSetupToken(token: string): Promise<string> {
  if (token.length < 32 || token.length > 256) {
    throw new Error("PIN setup token is invalid.");
  }

  return hashCredential(token);
}

async function verifyCredential(
  secret: string,
  encodedHash: string,
): Promise<boolean> {
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

    const derivedKey = await deriveKey(secret, salt, {
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

export async function verifyPin(
  pin: string,
  encodedHash: string,
): Promise<boolean> {
  if (!isValidPin(pin)) {
    return false;
  }

  return verifyCredential(pin, encodedHash);
}

export async function verifyPinSetupToken(
  token: string,
  encodedHash: string,
): Promise<boolean> {
  if (token.length < 32 || token.length > 256) {
    return false;
  }

  return verifyCredential(token, encodedHash);
}
