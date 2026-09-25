import { createHmac, randomBytes } from "node:crypto";

import { getAppBaseUrl } from "./app-url";

export class VerificationConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VerificationConfigurationError";
  }
}

export type EmailVerificationTokenState =
  | "valid"
  | "expired"
  | "used"
  | "invalid";

type StoredEmailVerificationToken = {
  expires_at: string;
  used_at: string | null;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getSecret(name: "EMAIL_VERIFICATION_SECRET" | "PIN_RESET_SECRET"): string {
  const value = process.env[name];

  if (!value) {
    throw new VerificationConfigurationError(`${name} is not configured.`);
  }

  return value;
}

function hashToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("hex");
}

function getPositiveNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function generateVerificationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashEmailVerificationToken(token: string): string {
  return hashToken(token, getSecret("EMAIL_VERIFICATION_SECRET"));
}

export function hashPinResetToken(token: string): string {
  return hashToken(token, getSecret("PIN_RESET_SECRET"));
}

export function getEmailVerificationTokenTtlMinutes(): number {
  return getPositiveNumber("EMAIL_VERIFICATION_TOKEN_TTL_MINUTES", 24 * 60);
}

export function getPinResetTokenTtlMinutes(): number {
  return getPositiveNumber("PIN_RESET_TOKEN_TTL_MINUTES", 30);
}

export function getEmailVerificationResendSeconds(): number {
  return getPositiveNumber("EMAIL_VERIFICATION_RESEND_SECONDS", 60);
}

export function getPinResetResendSeconds(): number {
  return getPositiveNumber("PIN_RESET_RESEND_SECONDS", 60);
}

export function getEmailVerificationUrl(token: string): string {
  return `${getAppBaseUrl()}/verify-email/${token}`;
}

export function getEmailVerificationTokenState(
  token: StoredEmailVerificationToken | null | undefined,
  now = new Date(),
): EmailVerificationTokenState {
  if (!token) {
    return "invalid";
  }

  if (token.used_at) {
    return "used";
  }

  const expiresAt = Date.parse(token.expires_at);

  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
    return "expired";
  }

  return "valid";
}

export function getPinResetUrl(token: string): string {
  return `${getAppBaseUrl()}/reset-pin/${token}`;
}
