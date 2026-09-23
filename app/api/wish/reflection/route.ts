import { NextResponse } from "next/server";

import { getCurrentReturnSession } from "@/lib/return-auth";
import {
  getSupabaseAdmin,
  MissingSupabaseConfigError,
} from "@/lib/supabase-server";
import {
  calculateNextReminderSchedule,
  MAX_WISH_CONTENT_LENGTH,
  REMINDER_MONTHS,
  type ReminderMonths,
} from "@/lib/wish-journey";

export const runtime = "nodejs";

const RESPONSE_TYPES = [
  "nothing_changed",
  "something_changed",
  "future_note",
  "remind_later",
] as const;

type ResponseType = (typeof RESPONSE_TYPES)[number];

function isResponseType(value: unknown): value is ResponseType {
  return RESPONSE_TYPES.includes(value as ResponseType);
}

function isReminderMonths(value: unknown): value is ReminderMonths {
  return REMINDER_MONTHS.includes(value as ReminderMonths);
}


export async function POST(request: Request) {
  const session = await getCurrentReturnSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Please check your reflection and try again." },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "Please check your reflection and try again." },
      { status: 400 },
    );
  }

  const input = body as Record<string, unknown>;

  if (!isResponseType(input.responseType)) {
    return NextResponse.json(
      { error: "Choose how your wish is going." },
      { status: 400 },
    );
  }

  const note = typeof input.note === "string" ? input.note.trim() : "";

  if (note.length > 1000) {
    return NextResponse.json(
      { error: "Note must be 1000 characters or fewer." },
      { status: 400 },
    );
  }

  const wishContent =
    typeof input.wishContent === "string" ? input.wishContent.trim() : "";

  if (!wishContent) {
    return NextResponse.json({ error: "Wish cannot be empty." }, { status: 400 });
  }

  if (wishContent.length > MAX_WISH_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `Wish must be ${MAX_WISH_CONTENT_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }

  let newReminder: ReturnType<typeof calculateNextReminderSchedule> | null = null;

  if (input.responseType === "remind_later" && !isReminderMonths(input.remindMonths)) {
    return NextResponse.json(
      { error: "Choose 1, 3, 6, or 12 months for the next reminder." },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: activeWish, error: activeWishError } = await supabase
      .from("wishes")
      .select("id")
      .eq("id", session.wishId)
      .is("deleted_at", null)
      .maybeSingle();

    if (activeWishError) {
      console.error("Failed to verify Wish before reflection:", activeWishError);
      return NextResponse.json(
        { error: "Unable to save your reflection right now." },
        { status: 503 },
      );
    }

    if (!activeWish) {
      return NextResponse.json({ error: "Wish not found." }, { status: 404 });
    }

    if (input.responseType === "remind_later") {
      const { data: existingReminders, error: remindersError } = await supabase
        .from("wish_reminders")
        .select("reminder_date, status")
        .eq("wish_id", session.wishId);

      if (remindersError) {
        console.error("Failed to load reminder history:", remindersError);
        return NextResponse.json(
          { error: "Unable to save your reflection right now." },
          { status: 503 },
        );
      }

      newReminder = calculateNextReminderSchedule(
        input.remindMonths as ReminderMonths,
        (existingReminders ?? []).map((reminder) => ({
          reminderDate: reminder.reminder_date,
          status: reminder.status,
        })),
        new Date(),
      );
    }
    const { data, error } = await supabase.rpc("save_wish_reflection", {
      p_wish_id: session.wishId,
      p_reminder_id: session.reminderId,
      p_response_type: input.responseType,
      p_note: note || null,
      p_wish_content: wishContent,
      p_new_reminder: newReminder,
    });

    if (error) {
      console.error("Failed to save reflection:", error);
      return NextResponse.json(
        { error: "Unable to save your reflection right now." },
        { status: 503 },
      );
    }

    return NextResponse.json({
      saved: true,
      reflection: Array.isArray(data) ? data[0] : data,
    });
  } catch (error) {
    if (!(error instanceof MissingSupabaseConfigError)) {
      console.error("Unexpected reflection error:", error);
    }

    return NextResponse.json(
      { error: "Unable to save your reflection right now." },
      { status: 503 },
    );
  }
}





