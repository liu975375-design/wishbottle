import { NextResponse } from "next/server";

import { getAppBaseUrl, isSecureAppBaseUrl } from "@/lib/app-url";
import {
  createReturnSessionValue,
  getReturnSessionCookieOptions,
  hashReturnToken,
  RETURN_SESSION_COOKIE,
} from "@/lib/return-session";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

type ReturnTokenRow = {
  wish_id: string;
  reminder_id: string | null;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;

  try {
    const baseUrl = getAppBaseUrl();
    const tokenHash = hashReturnToken(token);
    const now = new Date().toISOString();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("wish_return_tokens")
      .update({ used_at: now })
      .eq("token_hash", tokenHash)
      .is("used_at", null)
      .gt("expires_at", now)
      .select("wish_id, reminder_id")
      .maybeSingle<ReturnTokenRow>();

    if (error) {
      console.error("Failed to consume return token:", error);
      return NextResponse.redirect(new URL("/return/invalid", baseUrl));
    }

    if (!data) {
      return NextResponse.redirect(new URL("/return/invalid", baseUrl));
    }

    const response = NextResponse.redirect(new URL("/wish", baseUrl));
    response.cookies.set(
      RETURN_SESSION_COOKIE,
      createReturnSessionValue(data.wish_id, data.reminder_id),
      getReturnSessionCookieOptions(isSecureAppBaseUrl()),
    );

    return response;
  } catch (error) {
    console.error("Unexpected return token error:", error);

    try {
      return NextResponse.redirect(
        new URL("/return/invalid", getAppBaseUrl()),
      );
    } catch {
      return NextResponse.json(
        { error: "Return links are not configured." },
        { status: 503 },
      );
    }
  }
}
