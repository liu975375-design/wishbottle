import { NextResponse } from "next/server";

import { getAppBaseUrl } from "@/lib/app-url";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import {
  getEmailVerificationTokenState,
  hashEmailVerificationToken,
  type EmailVerificationTokenState,
} from "@/lib/verification";

export const runtime = "nodejs";

type StoredEmailVerificationToken = {
  expires_at: string;
  used_at: string | null;
};

function redirectToResult(baseUrl: string, result: string) {
  return NextResponse.redirect(new URL(`/email-verified?result=${result}`, baseUrl));
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  let baseUrl: string;

  try {
    baseUrl = getAppBaseUrl();
  } catch (error) {
    console.error("[Email Verification] APP_BASE_URL is not configured", error);
    return NextResponse.json(
      { error: "Email verification is not configured." },
      { status: 503 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const tokenHash = hashEmailVerificationToken(token);
    const { data: storedToken, error: tokenLookupError } = await supabase
      .from("email_verification_tokens")
      .select("expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle<StoredEmailVerificationToken>();

    if (tokenLookupError) {
      console.error("[Email Verification] Failed to look up token", {
        errorCode: tokenLookupError.code ?? null,
        errorMessage: tokenLookupError.message,
        timestamp: new Date().toISOString(),
      });
      return redirectToResult(baseUrl, "error");
    }

    const initialState = getEmailVerificationTokenState(storedToken);

    if (initialState !== "valid") {
      return redirectToResult(baseUrl, initialState);
    }

    const { data, error } = await supabase.rpc("verify_email_token", {
      p_token_hash: tokenHash,
    });

    if (error) {
      console.error("[Email Verification] Token verification RPC failed", {
        errorCode: error.code ?? null,
        errorMessage: error.message,
        timestamp: new Date().toISOString(),
      });
      return redirectToResult(baseUrl, "error");
    }

    if (data === true) {
      return redirectToResult(baseUrl, "success");
    }

    const { data: latestToken, error: latestTokenError } = await supabase
      .from("email_verification_tokens")
      .select("expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle<StoredEmailVerificationToken>();

    if (latestTokenError) {
      console.error("[Email Verification] Failed to re-check token state", {
        errorCode: latestTokenError.code ?? null,
        errorMessage: latestTokenError.message,
        timestamp: new Date().toISOString(),
      });
      return redirectToResult(baseUrl, "error");
    }

    const finalState: EmailVerificationTokenState =
      getEmailVerificationTokenState(latestToken);

    return redirectToResult(
      baseUrl,
      finalState === "valid" ? "error" : finalState,
    );
  } catch (error) {
    console.error("[Email Verification] Unexpected token verification error", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unknown error.",
      timestamp: new Date().toISOString(),
    });

    return redirectToResult(baseUrl, "error");
  }
}
