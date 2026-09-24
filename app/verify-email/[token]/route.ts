import { NextResponse } from "next/server";

import { getAppBaseUrl } from "@/lib/app-url";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { hashEmailVerificationToken } from "@/lib/verification";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;

  try {
    const baseUrl = getAppBaseUrl();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("verify_email_token", {
      p_token_hash: hashEmailVerificationToken(token),
    });

    if (error) {
      console.error("Failed to verify email token:", error);
      return NextResponse.redirect(
        new URL("/email-verified?result=invalid", baseUrl),
      );
    }

    return NextResponse.redirect(
      new URL(
        data === true
          ? "/email-verified?result=success"
          : "/email-verified?result=invalid",
        baseUrl,
      ),
    );
  } catch (error) {
    console.error("Unexpected email verification error:", error);

    try {
      return NextResponse.redirect(
        new URL("/email-verified?result=invalid", getAppBaseUrl()),
      );
    } catch {
      return NextResponse.json(
        { error: "Email verification is not configured." },
        { status: 503 },
      );
    }
  }
}

