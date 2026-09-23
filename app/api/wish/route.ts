import { NextResponse } from "next/server";

import { MAX_WISH_CONTENT_LENGTH } from "@/lib/wish-journey";
import { getCurrentReturnSession } from "@/lib/return-auth";
import {
  getSupabaseAdmin,
  MissingSupabaseConfigError,
} from "@/lib/supabase-server";

export const runtime = "nodejs";

type AuthorizedWish = {
  id: string;
  wish_code: string;
  wish_content: string;
  created_at: string;
  updated_at: string;
};

type ReminderRow = {
  id: string;
  reminder_months: number;
  reminder_date: string;
  scheduled_at: string;
  status: string;
  sent_at: string | null;
  attempt_count: number;
};

async function getAuthorizedWish() {
  const session = await getCurrentReturnSession();

  if (!session) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const { data: wish, error } = await supabase
    .from("wishes")
    .select(
      "id, wish_code, wish_content, created_at, updated_at",
    )
    .eq("id", session.wishId)
    .is("deleted_at", null)
    .maybeSingle<AuthorizedWish>();

  if (error || !wish) {
    if (error) {
      console.error("Failed to load authorized wish:", error);
    }
    return null;
  }

  const { data: reminders, error: remindersError } = await supabase
    .from("wish_reminders")
    .select(
      "id, reminder_months, reminder_date, scheduled_at, status, sent_at, attempt_count",
    )
    .eq("wish_id", wish.id)
    .order("reminder_date", { ascending: true });

  if (remindersError) {
    console.error("Failed to load wish reminders:", remindersError);
    return null;
  }

  return {
    wish,
    reminders: (reminders ?? []) as ReminderRow[],
  };
}

export async function GET() {
  try {
    const result = await getAuthorizedWish();

    if (!result) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (!(error instanceof MissingSupabaseConfigError)) {
      console.error("Unexpected authorized wish error:", error);
    }

    return NextResponse.json(
      { error: "Unable to load your wish right now." },
      { status: 503 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getCurrentReturnSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Please check your wish and try again." },
      { status: 400 },
    );
  }

  const wishContent =
    typeof body === "object" &&
    body !== null &&
    "wishContent" in body &&
    typeof body.wishContent === "string"
      ? body.wishContent.trim()
      : "";

  if (!wishContent) {
    return NextResponse.json({ error: "Wish cannot be empty." }, { status: 400 });
  }

  if (wishContent.length > MAX_WISH_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `Wish must be ${MAX_WISH_CONTENT_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("wishes")
      .update({ wish_content: wishContent })
      .eq("id", session.wishId)
      .is("deleted_at", null)
      .select(
        "id, wish_code, wish_content, created_at, updated_at",
      )
      .maybeSingle<AuthorizedWish>();

    if (error) {
      console.error("Failed to update authorized wish:", error);
      return NextResponse.json(
        { error: "Unable to update your wish right now." },
        { status: 503 },
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Wish not found." }, { status: 404 });
    }

    return NextResponse.json({ wish: data });
  } catch (error) {
    console.error("Unexpected wish update error:", error);
    return NextResponse.json(
      { error: "Unable to update your wish right now." },
      { status: 503 },
    );
  }
}

export async function DELETE() {
  const session = await getCurrentReturnSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: deleted, error } = await supabase.rpc("soft_delete_wish", {
      p_wish_id: session.wishId,
    });

    if (error) {
      console.error("Failed to soft delete Wish:", error);
      return NextResponse.json(
        { error: "Unable to delete your wish right now." },
        { status: 503 },
      );
    }

    if (!deleted) {
      return NextResponse.json({ error: "Wish not found." }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (!(error instanceof MissingSupabaseConfigError)) {
      console.error("Unexpected Wish delete error:", error);
    }

    return NextResponse.json(
      { error: "Unable to delete your wish right now." },
      { status: 503 },
    );
  }
}
