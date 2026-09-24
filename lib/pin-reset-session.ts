import { createHmac, timingSafeEqual } from "node:crypto";

export const PIN_RESET_SESSION_COOKIE = "wish_pin_reset_session";

const SESSION_TTL_SECONDS = 15 * 60;

export type PinResetSession = {
  wishId: string;
  tokenHash: string;
  expiresAt: number;
};

function getSecret(): string {
  const value = process.env.PIN_RESET_SECRET;

  if (!value) {
    throw new Error("PIN_RESET_SECRET is not configured.");
  }

  return value;
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", getSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function createPinResetSessionValue(
  wishId: string,
  tokenHash: string,
): string {
  const payload: PinResetSession = {
    wishId,
    tokenHash,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyPinResetSessionValue(
  value: string,
): PinResetSession | null {
  const [encodedPayload, signature] = value.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = sign(encodedPayload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<PinResetSession>;

    if (
      typeof payload.wishId !== "string" ||
      typeof payload.tokenHash !== "string" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return {
      wishId: payload.wishId,
      tokenHash: payload.tokenHash,
      expiresAt: payload.expiresAt,
    };
  } catch {
    return null;
  }
}

export function getPinResetSessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
