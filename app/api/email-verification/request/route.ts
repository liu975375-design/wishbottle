import { NextResponse } from "next/server";

import { EmailProviderError } from "@/lib/email";
import {
  failedEmailVerificationResult,
  sendVerificationForWish,
} from "@/lib/email-verification-service";
import { verifyPin } from "@/lib/pin";
import {
  getSupabaseAdmin,
  MissingSupabaseConfigError,
} from "@/lib/supabase-server";
import { validateFindWishInput } from "@/lib/validation";

export const runtime = "nodejs";

type WishForVerification = {
  id: string;
  wish_code: string;
  name: string;
  contact_email: string | null;
  email_verified_at: string | null;
  pin_hash: string;
};

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Unable to send verification email." },
      { status: 400 },
    );
  }

  const validation = validateFindWishInput(body);

  if (!validation.ok) {
    return NextResponse.json(
      { error: "Wish Code or PIN is incorrect." },
      { status: 401 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: wish, error } = await supabase
      .from("wishes")
      .select(
        "id, wish_code, name, contact_email, email_verified_at, pin_hash",
      )
      .eq("wish_code", validation.data.wishCode)
      .is("deleted_at", null)
      .maybeSingle<WishForVerification>();

    if (error) {
      console.error("Failed to load Wish for verification:", error);
      return NextResponse.json(
        { error: "Unable to send verification email." },
        { status: 503 },
      );
    }

    if (
      !wish ||
      !(await verifyPin(validation.data.pin, wish.pin_hash))
    ) {
      return NextResponse.json(
        { error: "Wish Code or PIN is incorrect." },
        { status: 401 },
      );
    }

    if (!wish.contact_email) {
      return NextResponse.json(
        {
          error:
            "Without an email, we cannot help recover your PIN later.",
        },
        { status: 400 },
      );
    }

    if (wish.email_verified_at) {
      return NextResponse.json({
        success: true,
        emailVerification: {
          required: true,
          status: "already_verified",
          verified: true,
          sent: false,
          cooldown: false,
          retryable: false,
        },
      });
    }

    const result = await sendVerificationForWish({
      apiRoute: "/api/email-verification/request",
      wishId: wish.id,
      email: wish.contact_email,
      name: wish.name,
    });

    return NextResponse.json({
      success: true,
      emailVerification: result,
      sent: result.sent,
      verified: result.verified,
      cooldown: result.cooldown,
    });
  } catch (error) {
    if (error instanceof EmailProviderError) {
      return NextResponse.json(
        {
          error: "Email verification could not be sent. Please try again.",
          emailVerification: failedEmailVerificationResult(),
        },
        { status: 502 },
      );
    }

    if (!(error instanceof MissingSupabaseConfigError)) {
      console.error("Unexpected verification request error:", error);
    }

    return NextResponse.json(
      {
        error: "Unable to send verification email.",
        emailVerification: failedEmailVerificationResult(),
      },
      { status: 503 },
    );
  }
}
