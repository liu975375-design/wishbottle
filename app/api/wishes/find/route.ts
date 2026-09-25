import { NextResponse } from "next/server";

import { verifyPin } from "@/lib/pin";
import {
  getSupabaseAdmin,
  MissingSupabaseConfigError,
} from "@/lib/supabase-server";
import { validateFindWishInput } from "@/lib/validation";

export const runtime = "nodejs";

const WISH_NOT_FOUND_MESSAGE = "Wish not found. Please check your Wish Code.";
const INCORRECT_PIN_MESSAGE = "Incorrect PIN. Please try again.";

type FoundWish = {
  wish_code: string;
  wish_content: string;
  pin_hash: string;
  created_at: string;
};

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: WISH_NOT_FOUND_MESSAGE },
      { status: 400 },
    );
  }

  const validation = validateFindWishInput(body);

  if (!validation.ok) {
    const hasWishCode =
      typeof body === "object" &&
      body !== null &&
      "wishCode" in body &&
      typeof body.wishCode === "string" &&
      body.wishCode.trim().length > 0;

    return NextResponse.json(
      { error: hasWishCode ? INCORRECT_PIN_MESSAGE : WISH_NOT_FOUND_MESSAGE },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("wishes")
      .select("wish_code, wish_content, pin_hash, created_at")
      .eq("wish_code", validation.data.wishCode)
      .is("deleted_at", null)
      .maybeSingle<FoundWish>();

    if (error) {
      console.error("Failed to find wish:", error);
      return NextResponse.json(
        { error: "Unable to find your wish right now. Please try again." },
        { status: 503 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: WISH_NOT_FOUND_MESSAGE },
        { status: 404 },
      );
    }

    const pinMatches = await verifyPin(validation.data.pin, data.pin_hash);

    if (!pinMatches) {
      return NextResponse.json(
        { error: INCORRECT_PIN_MESSAGE },
        { status: 401 },
      );
    }

    return NextResponse.json({
      wish: {
        wishCode: data.wish_code,
        wishContent: data.wish_content,
        createdAt: data.created_at,
      },
    });
  } catch (error) {
    if (error instanceof MissingSupabaseConfigError) {
      console.error(error.message);
    } else {
      console.error("Unexpected find wish error:", error);
    }

    return NextResponse.json(
      { error: "Unable to find your wish right now. Please try again." },
      { status: 503 },
    );
  }
}

