import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const RETURN_SESSION_COOKIE = "wish_return_session";

const SESSION_TTL_SECONDS = 60 * 60 * 24;

export type ReturnSession = {
  wishId: string;
  reminderId: string | null;
  expiresAt: number;
};

export function assertReturnSessionConfiguration(): void {
  getSessionSecret();
}

function getSessionSecret(): string {
  const secret = process.env.RETURN_SESSION_SECRET;

  if (!secret) {
    throw new Error("RETURN_SESSION_SECRET is not configured.");
  }

  return secret;
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function generateReturnToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashReturnToken(token: string): string {
  return createHmac("sha256", getSessionSecret()).update(token).digest("hex");
}

export function createReturnSessionValue(
  wishId: string,
  reminderId: string | null,
): string {
  const payload: ReturnSession = {
    wishId,
    reminderId,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyReturnSessionValue(value: string): ReturnSession | null {
  const [encodedPayload, signature] = value.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<ReturnSession>;

    if (
      typeof payload.wishId !== "string" ||
      (payload.reminderId !== null &&
        typeof payload.reminderId !== "string") ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return {
      wishId: payload.wishId,
      reminderId: payload.reminderId ?? null,
      expiresAt: payload.expiresAt,
    };
  } catch {
    return null;
  }
}

export function getReturnSessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

