import { NextResponse } from "next/server";

import { EmailProviderError } from "@/lib/email";
import { sendVerificationForWish } from "@/lib/email-verification-service";
import { maskEmailAddress } from "@/lib/pin-reset";
import {
  getSupabaseAdmin,
  MissingSupabaseConfigError,
} from "@/lib/supabase-server";
import { isValidEmail, normalizeWishCode } from "@/lib/validation";
import { normalizeEmail } from "@/lib/verification";

export const runtime = "nodejs";

const ROUTE = "/api/pin-reset/verification-request";
const INVALID_WISH_CODE_MESSAGE =
  "Wish not found. Please check your Wish Code.";
const SEND_FAILED_MESSAGE =
  "Verification email could not be sent. Please try again.";
const EMAIL_MISMATCH_MESSAGE =
  "The email does not match this Wish. Please check your details and try again.";

type WishForVerification = {
  id: string;
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
      .select("id, name, contact_email, email_verified_at")
      .eq("wish_code", wishCode)
      .is("deleted_at", null)
      .maybeSingle<WishForVerification>();

    if (error) {
      console.error("[PIN Reset] Failed to load Wish for verification", {
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

    if (wish.email_verified_at) {
      return NextResponse.json({
        status: "already_verified",
        maskedEmail,
        message:
          "This email is already verified. You can now request a reset link.",
      });
    }

    const result = await sendVerificationForWish({
      apiRoute: ROUTE,
      wishId: wish.id,
      email: wish.contact_email,
      name: wish.name,
    });

    if (result.status === "already_verified") {
      return NextResponse.json({
        status: "already_verified",
        maskedEmail,
        message:
          "This email is already verified. You can now request a reset link.",
      });
    }

    if (result.status === "cooldown") {
      return NextResponse.json(
        {
          status: "rate_limited",
          maskedEmail,
          message:
            "A verification email was sent recently. Please check your inbox or wait before trying again.",
        },
        { status: 429 },
      );
    }

    if (result.status !== "sent") {
      return NextResponse.json(
        { status: "send_failed", error: SEND_FAILED_MESSAGE },
        { status: 503 },
      );
    }

    return NextResponse.json({
      status: "sent",
      maskedEmail,
      message:
        "Verification email sent. Verify your email, then request a reset link again.",
    });
  } catch (error) {
    if (
      !(error instanceof EmailProviderError) &&
      !(error instanceof MissingSupabaseConfigError)
    ) {
      console.error("[PIN Reset] Unexpected verification request error", {
        route: ROUTE,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : "Unknown error.",
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { status: "send_failed", error: SEND_FAILED_MESSAGE },
      { status: error instanceof EmailProviderError ? 502 : 503 },
    );
  }
}
