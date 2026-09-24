import { NextResponse } from "next/server";

import {
  getVerifiedEmailAt,
  sendVerificationForWish,
  type EmailVerificationResult,
} from "@/lib/email-verification-service";
import { hashPin } from "@/lib/pin";
import {
  getSupabaseAdmin,
  MissingSupabaseConfigError,
} from "@/lib/supabase-server";
import { validateCreateWishInput } from "@/lib/validation";
import { validateWishJourneyInput } from "@/lib/wish-journey";
import {
  generateWishCodeBase,
  InvalidWishCodeNameError,
  WISH_CODE_MAX_ATTEMPTS,
  wishCodeForAttempt,
} from "@/lib/wish-code";

export const runtime = "nodejs";

type CreatedWish = {
  id: string;
  wish_code: string;
  wish_content: string;
  created_at: string;
};

function getTestIntervalMinutes(): number | undefined {
  const value = Number(process.env.REMINDER_TEST_INTERVAL_MINUTES);

  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Please check the form and try again." },
      { status: 400 },
    );
  }

  const validation = validateCreateWishInput(body);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const journeyValidation = validateWishJourneyInput(
    body,
    new Date(),
    getTestIntervalMinutes(),
  );

  if (!journeyValidation.ok) {
    return NextResponse.json(
      { error: journeyValidation.error },
      { status: 400 },
    );
  }

  try {
    const pinHash = await hashPin(validation.data.pin);
    const baseCode = generateWishCodeBase(journeyValidation.data.name);
    const supabase = getSupabaseAdmin();
    const emailVerifiedAt = journeyValidation.data.contactEmail
      ? await getVerifiedEmailAt(journeyValidation.data.contactEmail)
      : null;

    for (let attempt = 1; attempt <= WISH_CODE_MAX_ATTEMPTS; attempt += 1) {
      const wishCode = wishCodeForAttempt(baseCode, attempt);
      const { data, error } = await supabase.rpc("create_wish_with_reminders", {
        p_idempotency_key: journeyValidation.data.idempotencyKey,
        p_wish_code: wishCode,
        p_wish_content: validation.data.wishContent,
        p_pin_hash: pinHash,
        p_name: journeyValidation.data.name,
        p_contact_type: journeyValidation.data.contactType,
        p_contact_email: journeyValidation.data.contactEmail,
        p_legacy_reminder_date: journeyValidation.data.legacyReminderDate,
        p_reminders: journeyValidation.data.reminders,
        p_email_verified_at: emailVerifiedAt,
      });

      if (!error && data) {
        const created = (Array.isArray(data) ? data[0] : data) as
          | CreatedWish
          | undefined;

        if (!created) {
          console.error("Create wish RPC returned no row.");
          return NextResponse.json(
            { error: "Unable to save your wish right now. Please try again." },
            { status: 503 },
          );
        }

        let emailVerification: EmailVerificationResult = {
          required: false,
          verified: false,
          sent: false,
          cooldown: false,
        };

        if (journeyValidation.data.contactEmail) {
          try {
            emailVerification = await sendVerificationForWish({
              wishId: created.id,
              email: journeyValidation.data.contactEmail,
              name: journeyValidation.data.name,
            });
          } catch (verificationError) {
            console.error("Failed to send email verification:", verificationError);
          }
        }

        return NextResponse.json(
          {
            wishCode: created.wish_code,
            wishContent: created.wish_content,
            createdAt: created.created_at,
            reminderCount: journeyValidation.data.reminders.length,
            emailVerification,
          },
          { status: 201 },
        );
      }

      if (error?.code === "23505") {
        continue;
      }

      console.error("Failed to create wish:", error);
      return NextResponse.json(
        { error: "Unable to save your wish right now. Please try again." },
        { status: 503 },
      );
    }

    console.error(
      "Failed to create wish after Wish Code collision retries:",
      baseCode,
    );
    return NextResponse.json(
      { error: "Unable to save your wish right now. Please try again." },
      { status: 503 },
    );
  } catch (error) {
    if (error instanceof InvalidWishCodeNameError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof MissingSupabaseConfigError) {
      console.error(error.message);
    } else {
      console.error("Unexpected create wish error:", error);
    }

    return NextResponse.json(
      { error: "Unable to save your wish right now. Please try again." },
      { status: 503 },
    );
  }
}


