import { NextResponse } from "next/server";

import { hashPin, verifyPinSetupToken } from "@/lib/pin";
import {
  getSupabaseAdmin,
  MissingSupabaseConfigError,
} from "@/lib/supabase-server";
import { isValidPin, normalizeWishCode } from "@/lib/validation";

export const runtime = "nodejs";

const INVALID_SETUP_MESSAGE = "Unable to set a PIN for this wish.";

type SetupBody = {
  wishCode?: unknown;
  setupToken?: unknown;
  pin?: unknown;
  confirmPin?: unknown;
};

type WishPinRecord = {
  id: string;
  pin_hash: string;
};

export async function POST(request: Request) {
  let body: SetupBody;

  try {
    body = (await request.json()) as SetupBody;
  } catch {
    return NextResponse.json(
      { error: "Please check the PIN form and try again." },
      { status: 400 },
    );
  }

  const wishCode =
    typeof body.wishCode === "string" ? normalizeWishCode(body.wishCode) : "";
  const setupToken =
    typeof body.setupToken === "string" ? body.setupToken : "";
  const pin = typeof body.pin === "string" ? body.pin : "";
  const confirmPin =
    typeof body.confirmPin === "string" ? body.confirmPin : "";

  if (!wishCode || !setupToken) {
    return NextResponse.json({ error: INVALID_SETUP_MESSAGE }, { status: 400 });
  }

  if (!isValidPin(pin)) {
    return NextResponse.json(
      { error: "PIN must be exactly 4 digits." },
      { status: 400 },
    );
  }

  if (pin !== confirmPin) {
    return NextResponse.json(
      { error: "PIN and Confirm PIN must match." },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("wishes")
      .select("id, pin_hash")
      .eq("wish_code", wishCode)
      .is("deleted_at", null)
      .maybeSingle<WishPinRecord>();

    if (error) {
      console.error("Failed to load wish for PIN setup:", error);
      return NextResponse.json(
        { error: "Unable to set a PIN right now. Please try again." },
        { status: 503 },
      );
    }

    if (!data || !(await verifyPinSetupToken(setupToken, data.pin_hash))) {
      return NextResponse.json({ error: INVALID_SETUP_MESSAGE }, { status: 401 });
    }

    const pinHash = await hashPin(pin);
    const { data: updated, error: updateError } = await supabase
      .from("wishes")
      .update({ pin_hash: pinHash })
      .eq("id", data.id)
      .eq("pin_hash", data.pin_hash)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (updateError) {
      console.error("Failed to set wish PIN:", updateError);
      return NextResponse.json(
        { error: "Unable to set a PIN right now. Please try again." },
        { status: 503 },
      );
    }

    if (!updated) {
      return NextResponse.json({ error: INVALID_SETUP_MESSAGE }, { status: 401 });
    }

    return NextResponse.json({ success: true, wishCode });
  } catch (error) {
    if (error instanceof MissingSupabaseConfigError) {
      console.error(error.message);
    } else {
      console.error("Unknown PIN setup error:", error);
    }

    return NextResponse.json(
      { error: "Unable to set a PIN right now. Please try again." },
      { status: 503 },
    );
  }
}
