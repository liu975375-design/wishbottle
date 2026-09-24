import { NextResponse } from "next/server";

import { getAppBaseUrl, isSecureAppBaseUrl } from "@/lib/app-url";
import {
  createPinResetSessionValue,
  getPinResetSessionCookieOptions,
  PIN_RESET_SESSION_COOKIE,
} from "@/lib/pin-reset-session";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { hashPinResetToken } from "@/lib/verification";

export const runtime = "nodejs";

type ResetTokenRow = {
  wish_id: string;
  expires_at: string;
  used_at: string | null;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;

  try {
    const baseUrl = getAppBaseUrl();
    const tokenHash = hashPinResetToken(token);
    const now = new Date().toISOString();
    const supabase = getSupabaseAdmin();
    const { data: tokenRecord, error: tokenError } = await supabase
      .from("pin_reset_tokens")
      .select("wish_id, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .is("used_at", null)
      .gt("expires_at", now)
      .maybeSingle<ResetTokenRow>();

    if (tokenError || !tokenRecord) {
      return NextResponse.redirect(
        new URL("/reset-pin?result=invalid", baseUrl),
      );
    }

    const { data: wish, error: wishError } = await supabase
      .from("wishes")
      .select("id, email_verified_at")
      .eq("id", tokenRecord.wish_id)
      .is("deleted_at", null)
      .maybeSingle<{ id: string; email_verified_at: string | null }>();

    if (wishError || !wish?.email_verified_at) {
      return NextResponse.redirect(
        new URL("/reset-pin?result=invalid", baseUrl),
      );
    }

    const response = NextResponse.redirect(new URL("/reset-pin", baseUrl));
    response.cookies.set(
      PIN_RESET_SESSION_COOKIE,
      createPinResetSessionValue(wish.id, tokenHash),
      getPinResetSessionCookieOptions(isSecureAppBaseUrl()),
    );

    return response;
  } catch (error) {
    console.error("Unexpected PIN reset link error:", error);

    try {
      return NextResponse.redirect(
        new URL("/reset-pin?result=invalid", getAppBaseUrl()),
      );
    } catch {
      return NextResponse.json(
        { error: "PIN reset is not configured." },
        { status: 503 },
      );
    }
  }
}

