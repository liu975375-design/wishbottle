import { NextResponse } from "next/server";

import { hashPin } from "@/lib/pin";
import { getCurrentPinResetSession } from "@/lib/pin-reset-auth";
import { PIN_RESET_SESSION_COOKIE } from "@/lib/pin-reset-session";
import {
  getSupabaseAdmin,
  MissingSupabaseConfigError,
} from "@/lib/supabase-server";
import { isValidPin } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getCurrentPinResetSession();

  if (!session) {
    return NextResponse.json(
      { error: "This PIN reset link is not valid." },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Please check your PIN and try again." },
      { status: 400 },
    );
  }

  const newPin =
    typeof body === "object" &&
    body !== null &&
    "newPin" in body &&
    typeof body.newPin === "string"
      ? body.newPin
      : "";
  const confirmPin =
    typeof body === "object" &&
    body !== null &&
    "confirmPin" in body &&
    typeof body.confirmPin === "string"
      ? body.confirmPin
      : "";

  if (!isValidPin(newPin)) {
    return NextResponse.json(
      { error: "PIN must be 4 to 6 digits." },
      { status: 400 },
    );
  }

  if (newPin !== confirmPin) {
    return NextResponse.json(
      { error: "PIN and Confirm PIN must match." },
      { status: 400 },
    );
  }

  try {
    const pinHash = await hashPin(newPin);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("complete_pin_reset", {
      p_wish_id: session.wishId,
      p_token_hash: session.tokenHash,
      p_pin_hash: pinHash,
    });

    if (error) {
      console.error("Failed to complete PIN reset:", error);
      return NextResponse.json(
        { error: "Unable to reset your PIN right now." },
        { status: 503 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "This PIN reset link has expired or already been used." },
        { status: 400 },
      );
    }

    const response = NextResponse.json({ reset: true });
    response.cookies.set(PIN_RESET_SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.APP_BASE_URL?.startsWith("https://") ?? false,
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    if (!(error instanceof MissingSupabaseConfigError)) {
      console.error("Unexpected PIN reset completion error:", error);
    }

    return NextResponse.json(
      { error: "Unable to reset your PIN right now." },
      { status: 503 },
    );
  }
}
