import { NextResponse } from "next/server";

import { getCurrentReturnSession } from "@/lib/return-auth";
import {
  getSupabaseAdmin,
  MissingSupabaseConfigError,
} from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST() {
  const session = await getCurrentReturnSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: wish, error: wishError } = await supabase
      .from("wishes")
      .select("id")
      .eq("id", session.wishId)
      .is("deleted_at", null)
      .maybeSingle();

    if (wishError) {
      console.error("Failed to verify Wish for reminder stop:", wishError);
      return NextResponse.json(
        { error: "Unable to stop reminders right now." },
        { status: 503 },
      );
    }

    if (!wish) {
      return NextResponse.json({ error: "Wish not found." }, { status: 404 });
    }

    const { data: stoppedReminders, error } = await supabase
      .from("wish_reminders")
      .update({
        status: "cancelled",
        last_error: "Stopped by user.",
      })
      .eq("wish_id", session.wishId)
      .eq("status", "pending")
      .select("id");

    if (error) {
      console.error("Failed to stop future reminders:", error);
      return NextResponse.json(
        { error: "Unable to stop reminders right now." },
        { status: 503 },
      );
    }

    return NextResponse.json({
      stopped: stoppedReminders?.length ?? 0,
    });
  } catch (error) {
    if (!(error instanceof MissingSupabaseConfigError)) {
      console.error("Unexpected stop reminder error:", error);
    }

    return NextResponse.json(
      { error: "Unable to stop reminders right now." },
      { status: 503 },
    );
  }
}
