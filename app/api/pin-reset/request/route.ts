import { NextResponse } from "next/server";

import { EmailProviderError, sendPinResetEmail } from "@/lib/email";
import {
  logPinResetEmailFailure,
  maskEmailAddress,
} from "@/lib/pin-reset";
import {
  getSupabaseAdmin,
  MissingSupabaseConfigError,
} from "@/lib/supabase-server";
import { isValidEmail, normalizeWishCode } from "@/lib/validation";
import {
  generateVerificationToken,
  getPinResetResendSeconds,
  getPinResetTokenTtlMinutes,
  getPinResetUrl,
  hashPinResetToken,
  normalizeEmail,
} from "@/lib/verification";

export const runtime = "nodejs";

const ROUTE = "/api/pin-reset/request";
const INVALID_WISH_CODE_MESSAGE =
  "Wish not found. Please check your Wish Code.";
const SEND_FAILED_MESSAGE =
  "Reset email could not be sent. Please try again.";
const EMAIL_MISMATCH_MESSAGE =
  "The email does not match this Wish. Please check your details and try again.";

type WishForReset = {
  id: string;
  wish_code: string;
  name: string;
  contact_email: string | null;
  email_verified_at: string | null;
};

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        status: "invalid_wish_code",
        error: "Please enter your Wish Code first.",
      },
      { status: 400 },
    );
  }

  const wishCode =
    typeof body === "object" &&
    body !== null &&
    "wishCode" in body &&
    typeof body.wishCode === "string"
      ? normalizeWishCode(body.wishCode)
      : "";
  const email =
    typeof body === "object" &&
    body !== null &&
    "email" in body &&
    typeof body.email === "string"
      ? normalizeEmail(body.email)
      : "";

  if (!wishCode) {
    return NextResponse.json(
      {
        status: "invalid_wish_code",
        error: "Please enter your Wish Code first.",
      },
      { status: 400 },
    );
  }

  if (!email) {
    return NextResponse.json(
      { status: "invalid_email", error: "Please enter your email first." },
      { status: 400 },
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { status: "invalid_email", error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: wish, error } = await supabase
      .from("wishes")
      .select("id, wish_code, name, contact_email, email_verified_at")
      .eq("wish_code", wishCode)
      .is("deleted_at", null)
      .maybeSingle<WishForReset>();

    if (error) {
      console.error("[PIN Reset] Failed to load Wish for reset", {
        route: ROUTE,
        errorCode: error.code ?? null,
        errorMessage: error.message,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { status: "send_failed", error: SEND_FAILED_MESSAGE },
        { status: 503 },
      );
    }

    if (!wish) {
      return NextResponse.json(
        { status: "invalid_wish_code", error: INVALID_WISH_CODE_MESSAGE },
        { status: 404 },
      );
    }

    if (
      !wish.contact_email ||
      normalizeEmail(wish.contact_email) !== email
    ) {
      return NextResponse.json(
        {
          status: "email_mismatch",
          error: EMAIL_MISMATCH_MESSAGE,
        },
        { status: 400 },
      );
    }

    const maskedEmail = maskEmailAddress(wish.contact_email);

    if (!wish.email_verified_at) {
      return NextResponse.json(
        {
          status: "email_verification_required",
          error:
            "Email verification is required before you can reset your PIN.",
          emailVerificationRequired: true,
        },
        { status: 400 },
      );
    }

    const cooldownSeconds = getPinResetResendSeconds();
    const cooldownStart = new Date(
      Date.now() - cooldownSeconds * 1000,
    ).toISOString();
    const now = new Date().toISOString();
    const { data: recentToken, error: recentTokenError } = await supabase
      .from("pin_reset_tokens")
      .select("id")
      .eq("wish_id", wish.id)
      .is("used_at", null)
      .gt("expires_at", now)
      .gt("created_at", cooldownStart)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentTokenError) {
      console.error("[PIN Reset] Failed to check resend cooldown", {
        route: ROUTE,
        wishId: wish.id,
        errorCode: recentTokenError.code ?? null,
        errorMessage: recentTokenError.message,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { status: "send_failed", error: SEND_FAILED_MESSAGE },
        { status: 503 },
      );
    }

    if (recentToken) {
      return NextResponse.json(
        {
          status: "rate_limited",
          maskedEmail,
          message:
            "A reset email was sent recently. Please check your inbox or wait before trying again.",
        },
        { status: 429 },
      );
    }

    const token = generateVerificationToken();
    const tokenHash = hashPinResetToken(token);
    const expiresAt = new Date(
      Date.now() + getPinResetTokenTtlMinutes() * 60 * 1000,
    ).toISOString();
    const { data: tokenRecord, error: tokenError } = await supabase
      .from("pin_reset_tokens")
      .insert({
        wish_id: wish.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .select("id")
      .single<{ id: string }>();

    if (tokenError) {
      console.error("[PIN Reset] Failed to create reset token", {
        route: ROUTE,
        wishId: wish.id,
        errorCode: tokenError.code ?? null,
        errorMessage: tokenError.message,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { status: "send_failed", error: SEND_FAILED_MESSAGE },
        { status: 503 },
      );
    }

    try {
      await sendPinResetEmail({
        to: wish.contact_email,
        name: wish.name,
        resetUrl: getPinResetUrl(token),
      });
    } catch (emailError) {
      logPinResetEmailFailure(
        { route: ROUTE, wishId: wish.id, email: wish.contact_email },
        emailError,
      );

      const { error: cleanupError } = await supabase
        .from("pin_reset_tokens")
        .delete()
        .eq("id", tokenRecord.id);

      if (cleanupError) {
        console.error("[PIN Reset] Failed to clean up unsent token", {
          route: ROUTE,
          wishId: wish.id,
          errorCode: cleanupError.code ?? null,
          errorMessage: cleanupError.message,
          timestamp: new Date().toISOString(),
        });
      }

      return NextResponse.json(
        { status: "send_failed", error: SEND_FAILED_MESSAGE },
        { status: emailError instanceof EmailProviderError ? 502 : 503 },
      );
    }

    return NextResponse.json({
      status: "sent",
      maskedEmail,
      message: "Reset link sent.",
    });
  } catch (error) {
    if (!(error instanceof MissingSupabaseConfigError)) {
      console.error("[PIN Reset] Unexpected reset request error", {
        route: ROUTE,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : "Unknown error.",
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { status: "send_failed", error: SEND_FAILED_MESSAGE },
      { status: 503 },
    );
  }
}
