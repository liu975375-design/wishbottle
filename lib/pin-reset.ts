import { EmailProviderError } from "./email";

export type PinResetTokenState = "valid" | "expired" | "used" | "invalid";

type StoredPinResetToken = {
  expires_at: string;
  used_at: string | null;
};

export function maskEmailAddress(email: string): string {
  const normalized = email.trim();
  const atIndex = normalized.lastIndexOf("@");

  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return "[invalid-email]";
  }

  const localPart = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const visible = localPart.slice(0, 1);

  return `${visible}***@${domain}`;
}

export function getPinResetTokenState(
  token: StoredPinResetToken | null | undefined,
  now = new Date(),
): PinResetTokenState {
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

type PinResetEmailLogContext = {
  route: string;
  wishId: string;
  email: string;
};

function redactLogText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi, "***@$1")
    .replace(/re_[A-Za-z0-9_-]{8,}/g, "[redacted-resend-key]")
    .replace(/bearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/reset-pin\/[A-Za-z0-9_-]+/gi, "reset-pin/[redacted-token]")
    .slice(0, 4_000);
}

function getStringField(error: unknown, field: string): string | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const value = (error as Record<string, unknown>)[field];

  return typeof value === "string" ? value : null;
}

export function logPinResetEmailFailure(
  context: PinResetEmailLogContext,
  error: unknown,
): void {
  const providerError = error instanceof EmailProviderError ? error : null;
  const message =
    error instanceof Error
      ? error.message
      : "Unknown PIN reset email error.";

  console.error("[PIN Reset] Failed to send reset email", {
    route: context.route,
    wishId: context.wishId,
    email: maskEmailAddress(context.email),
    provider: providerError?.provider ?? null,
    providerStatus: providerError?.status ?? null,
    errorCode:
      providerError?.code ??
      getStringField(error, "code") ??
      getStringField(error, "name"),
    errorMessage: redactLogText(message),
    responseBody: providerError?.responseBody
      ? redactLogText(providerError.responseBody)
      : null,
    timestamp: new Date().toISOString(),
  });
}
