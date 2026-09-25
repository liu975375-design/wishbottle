import { EmailProviderError, sendEmailVerificationEmail } from "./email";
import {
  generateVerificationToken,
  getEmailVerificationResendSeconds,
  getEmailVerificationTokenTtlMinutes,
  getEmailVerificationUrl,
  hashEmailVerificationToken,
  normalizeEmail,
} from "./verification";
import { getSupabaseAdmin } from "./supabase-server";

export type EmailVerificationStatus =
  | "not_required"
  | "already_verified"
  | "sent"
  | "cooldown"
  | "failed";

export type EmailVerificationResult = {
  required: boolean;
  status: EmailVerificationStatus;
  verified: boolean;
  sent: boolean;
  cooldown: boolean;
  retryable: boolean;
};

export function failedEmailVerificationResult(): EmailVerificationResult {
  return {
    required: true,
    status: "failed",
    verified: false,
    sent: false,
    cooldown: false,
    retryable: true,
  };
}

type EmailVerificationStage =
  | "status_lookup"
  | "verified_status_update"
  | "cooldown_lookup"
  | "token_create"
  | "url_build"
  | "provider_send";

type EmailVerificationLogContext = {
  apiRoute: string;
  stage: EmailVerificationStage;
  wishId: string;
  email: string;
};

function maskEmail(email: string): string {
  const atIndex = email.lastIndexOf("@");

  if (atIndex <= 0 || atIndex === email.length - 1) {
    return "[invalid-email]";
  }

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  const visibleLocalPart = localPart.slice(0, Math.min(2, localPart.length));

  return `${visibleLocalPart}***@${domain}`;
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi, "***@$1")
    .replace(/re_[A-Za-z0-9_-]{8,}/g, "[redacted-resend-key]")
    .replace(/bearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(
      /verify-email\/[A-Za-z0-9_-]+/gi,
      "verify-email/[redacted-token]",
    )
    .slice(0, 4_000);
}

function getErrorField(error: unknown, field: string): string | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const value = (error as Record<string, unknown>)[field];

  return typeof value === "string" ? value : null;
}

export function logEmailVerificationFailure(
  context: EmailVerificationLogContext,
  error: unknown,
): void {
  const providerError = error instanceof EmailProviderError ? error : null;
  const errorMessage =
    error instanceof Error
      ? error.message
      : "Unknown email verification error.";
  const errorDetails = getErrorField(error, "details");

  console.error("[Email Verification] Failed to send verification email", {
    apiRoute: context.apiRoute,
    stage: context.stage,
    wishId: context.wishId,
    email: maskEmail(context.email),
    provider: providerError?.provider ?? null,
    providerStatus: providerError?.status ?? null,
    errorCode:
      providerError?.code ??
      getErrorField(error, "code") ??
      getErrorField(error, "name"),
    errorMessage: redactSensitiveText(errorMessage),
    errorDetails: errorDetails ? redactSensitiveText(errorDetails) : null,
    responseBody: providerError?.responseBody
      ? redactSensitiveText(providerError.responseBody)
      : null,
    timestamp: new Date().toISOString(),
  });
}

export async function getVerifiedEmailAt(
  email: string,
): Promise<string | null> {
  const normalizedEmail = normalizeEmail(email);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("verified_emails")
    .select("verified_at")
    .eq("normalized_email", normalizedEmail)
    .maybeSingle<{ verified_at: string }>();

  if (error) {
    throw error;
  }

  return data?.verified_at ?? null;
}

type SendVerificationInput = {
  apiRoute: string;
  wishId: string;
  email: string;
  name: string;
};

export async function sendVerificationForWish({
  apiRoute,
  wishId,
  email,
  name,
}: SendVerificationInput): Promise<EmailVerificationResult> {
  const normalizedEmail = normalizeEmail(email);
  const supabase = getSupabaseAdmin();
  let stage: EmailVerificationStage = "status_lookup";
  let tokenRecord: { id: string } | null = null;

  try {
    const verifiedAt = await getVerifiedEmailAt(normalizedEmail);

    if (verifiedAt) {
      stage = "verified_status_update";
      const { error } = await supabase
        .from("wishes")
        .update({ email_verified_at: verifiedAt })
        .eq("id", wishId)
        .is("email_verified_at", null);

      if (error) {
        throw error;
      }

      return {
        required: true,
        status: "already_verified",
        verified: true,
        sent: false,
        cooldown: false,
        retryable: false,
      };
    }

    stage = "cooldown_lookup";
    const cooldownSeconds = getEmailVerificationResendSeconds();
    const cooldownStart = new Date(
      Date.now() - cooldownSeconds * 1000,
    ).toISOString();
    const now = new Date().toISOString();
    const { data: recentToken, error: recentTokenError } = await supabase
      .from("email_verification_tokens")
      .select("id")
      .eq("wish_id", wishId)
      .is("used_at", null)
      .gt("expires_at", now)
      .gt("created_at", cooldownStart)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentTokenError) {
      throw recentTokenError;
    }

    if (recentToken) {
      return {
        required: true,
        status: "cooldown",
        verified: false,
        sent: true,
        cooldown: true,
        retryable: false,
      };
    }

    stage = "token_create";
    const token = generateVerificationToken();
    const tokenHash = hashEmailVerificationToken(token);
    const expiresAt = new Date(
      Date.now() + getEmailVerificationTokenTtlMinutes() * 60 * 1000,
    ).toISOString();
    const { data: createdToken, error: tokenError } = await supabase
      .from("email_verification_tokens")
      .insert({
        wish_id: wishId,
        email: email.trim(),
        normalized_email: normalizedEmail,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .select("id")
      .single<{ id: string }>();

    if (tokenError) {
      throw tokenError;
    }

    tokenRecord = createdToken;
    stage = "url_build";
    const verificationUrl = getEmailVerificationUrl(token);
    stage = "provider_send";
    await sendEmailVerificationEmail({
      to: email.trim(),
      name,
      verificationUrl,
    });

    const { error: invalidateError } = await supabase
      .from("email_verification_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("wish_id", wishId)
      .is("used_at", null)
      .neq("id", tokenRecord.id);

    if (invalidateError) {
      console.error(
        "[Email Verification] Failed to invalidate previous verification tokens",
        {
          apiRoute,
          wishId,
          email: maskEmail(email),
          errorCode: invalidateError.code ?? null,
          errorMessage: redactSensitiveText(invalidateError.message),
          timestamp: new Date().toISOString(),
        },
      );
    }

    return {
      required: true,
      status: "sent",
      verified: false,
      sent: true,
      cooldown: false,
      retryable: false,
    };
  } catch (error) {
    logEmailVerificationFailure(
      { apiRoute, stage, wishId, email },
      error,
    );

    if (tokenRecord) {
      const { error: cleanupError } = await supabase
        .from("email_verification_tokens")
        .delete()
        .eq("id", tokenRecord.id);

      if (cleanupError) {
        console.error(
          "[Email Verification] Failed to clean up unsent verification token",
          {
            apiRoute,
            stage,
            wishId,
            email: maskEmail(email),
            errorCode: cleanupError.code ?? null,
            errorMessage: redactSensitiveText(cleanupError.message),
            timestamp: new Date().toISOString(),
          },
        );
      }
    }

    throw error;
  }
}
