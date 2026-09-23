import { NextResponse } from "next/server";

import { getAppBaseUrl } from "@/lib/app-url";
import { assertEmailConfiguration, sendReminderEmail } from "@/lib/email";
import {
  assertReturnSessionConfiguration,
  generateReturnToken,
  hashReturnToken,
} from "@/lib/return-session";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

type ClaimedReminder = {
  id: string;
  wish_id: string;
  reminder_months: number;
  reminder_date: string;
  status: string;
  attempt_count: number;
};

type ReminderWish = {
  id: string;
  wish_code: string;
  name: string;
  contact_type: string;
  contact_email: string | null;
};

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function getReturnTokenTtlDays(): number {
  const value = Number(process.env.RETURN_TOKEN_TTL_DAYS);

  return Number.isFinite(value) && value > 0 ? value : 14;
}

async function updateReminder(
  reminderId: string,
  values: Record<string, unknown>,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("wish_reminders")
    .update(values)
    .eq("id", reminderId);

  if (error) {
    console.error("Failed to update reminder status:", error);
  }
}

async function runScheduler(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "Reminder scheduler is not configured." },
      { status: 503 },
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    assertEmailConfiguration();
    assertReturnSessionConfiguration();
    getAppBaseUrl();
  } catch (error) {
    console.error("Reminder scheduler configuration error:", error);
    return NextResponse.json(
      { error: "Reminder scheduler is not configured." },
      { status: 503 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("claim_due_wish_reminders", {
    p_limit: 20,
  });

  if (error) {
    console.error("Failed to claim due reminders:", error);
    return NextResponse.json(
      { error: "Unable to run reminder scheduler." },
      { status: 503 },
    );
  }

  const reminders = (data ?? []) as ClaimedReminder[];

  if (reminders.length === 0) {
    return NextResponse.json({
      claimed: 0,
      sent: 0,
      failed: 0,
      cancelled: 0,
    });
  }

  const wishIds = [...new Set(reminders.map((reminder) => reminder.wish_id))];
  const { data: wishes, error: wishesError } = await supabase
    .from("wishes")
    .select("id, wish_code, name, contact_type, contact_email")
    .in("id", wishIds);

  if (wishesError) {
    console.error("Failed to load reminder wishes:", wishesError);
    for (const reminder of reminders) {
      await updateReminder(reminder.id, {
        status: "failed",
        last_error: "Unable to load Wish contact details.",
      });
    }

    return NextResponse.json(
      { error: "Unable to load reminder wishes." },
      { status: 503 },
    );
  }

  const wishMap = new Map(
    ((wishes ?? []) as ReminderWish[]).map((wish) => [wish.id, wish]),
  );
  const counts = { claimed: reminders.length, sent: 0, failed: 0, cancelled: 0 };

  for (const reminder of reminders) {
    const wish = wishMap.get(reminder.wish_id);

    if (!wish) {
      counts.failed += 1;
      await updateReminder(reminder.id, {
        status: "failed",
        last_error: "Wish not found.",
      });
      continue;
    }

    if (wish.contact_type === "no_email" || !wish.contact_email) {
      counts.cancelled += 1;
      await updateReminder(reminder.id, {
        status: "cancelled",
        last_error: "No contact email is available.",
      });
      continue;
    }

    try {
      const token = generateReturnToken();
      const expiresAt = new Date(
        Date.now() + getReturnTokenTtlDays() * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { error: tokenError } = await supabase
        .from("wish_return_tokens")
        .insert({
          wish_id: wish.id,
          reminder_id: reminder.id,
          token_hash: hashReturnToken(token),
          expires_at: expiresAt,
        });

      if (tokenError) {
        throw new Error("Unable to create return token.");
      }

      await sendReminderEmail({
        to: wish.contact_email,
        name: wish.name,
        wishCode: wish.wish_code,
        returnUrl: `${getAppBaseUrl()}/return/${token}`,
      });

      counts.sent += 1;
      await updateReminder(reminder.id, {
        status: "sent",
        sent_at: new Date().toISOString(),
        last_error: null,
      });
    } catch (emailError) {
      counts.failed += 1;
      await updateReminder(reminder.id, {
        status: "failed",
        last_error:
          emailError instanceof Error
            ? emailError.message.slice(0, 500)
            : "Unknown email error.",
      });
    }
  }

  return NextResponse.json(counts);
}

export async function GET(request: Request) {
  return runScheduler(request);
}

export async function POST(request: Request) {
  return runScheduler(request);
}
