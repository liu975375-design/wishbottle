import { NextResponse } from "next/server";

import { sendPinResetEmail } from "@/lib/email";
import {
  getSupabaseAdmin,
  MissingSupabaseConfigError,
} from "@/lib/supabase-server";
import { normalizeWishCode } from "@/lib/validation";
import {
  generateVerificationToken,
  getPinResetResendSeconds,
  getPinResetTokenTtlMinutes,
  getPinResetUrl,
  hashPinResetToken,
} from "@/lib/verification";

export const runtime = "nodejs";

type WishForReset = {
  id: string;
  wish_code: string;
  name: string;
  contact_email: string | null;
  email_verified_at: string | null;
};

const GENERIC_SENT_MESSAGE =
  "If this Wish has a verified email, a reset link has been sent.";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: GENERIC_SENT_MESSAGE }, { status: 400 });
  }

  const wishCode =
    typeof body === "object" &&
    body !== null &&
    "wishCode" in body &&
    typeof body.wishCode === "string"
      ? normalizeWishCode(body.wishCode)
      : "";

  if (!wishCode) {
    return NextResponse.json({ error: GENERIC_SENT_MESSAGE }, { status: 400 });
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
      console.error("Failed to load Wish for PIN reset:", error);
      return NextResponse.json(
        { error: "Unable to request a PIN reset right now." },
        { status: 503 },
      );
    }

    if (!wish) {
      return NextResponse.json({ message: GENERIC_SENT_MESSAGE });
    }

    if (!wish.contact_email) {
      return NextResponse.json(
        {
          error: "Without an email, we cannot help recover your PIN.",
        },
        { status: 400 },
      );
    }

    if (!wish.email_verified_at) {
      return NextResponse.json(
        {
          error: "Please verify your email before resetting your PIN.",
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
      .limit(1)
      .maybeSingle();

    if (recentTokenError) {
      console.error("Failed to check PIN reset cooldown:", recentTokenError);
      return NextResponse.json(
        { error: "Unable to request a PIN reset right now." },
        { status: 503 },
      );
    }

    if (recentToken) {
      return NextResponse.json({ message: GENERIC_SENT_MESSAGE, cooldown: true });
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
      console.error("Failed to create PIN reset token:", tokenError);
      return NextResponse.json(
        { error: "Unable to request a PIN reset right now." },
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
      await supabase
        .from("pin_reset_tokens")
        .delete()
        .eq("id", tokenRecord.id);
      console.error("Failed to send PIN reset email:", emailError);
      return NextResponse.json(
        { error: "Unable to request a PIN reset right now." },
        { status: 503 },
      );
    }

    return NextResponse.json({ message: GENERIC_SENT_MESSAGE });
  } catch (error) {
    if (!(error instanceof MissingSupabaseConfigError)) {
      console.error("Unexpected PIN reset request error:", error);
    }

    return NextResponse.json(
      { error: "Unable to request a PIN reset right now." },
      { status: 503 },
    );
  }
}
