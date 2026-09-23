import type { ValidationResult } from "./validation";

export const CONTACT_TYPES = [
  "own_email",
  "parent_carer_email",
  "no_email",
] as const;

export const REMINDER_MONTHS = [1, 3, 6, 12] as const;
export const MAX_WISH_CONTENT_LENGTH = 200;

export type ContactType = (typeof CONTACT_TYPES)[number];
export type ReminderMonths = (typeof REMINDER_MONTHS)[number];

export type ReminderSchedule = {
  months: ReminderMonths;
  reminderDate: string;
  scheduledAt: string;
};

export type WishJourneyInput = {
  idempotencyKey: string;
  name: string;
  contactType: ContactType;
  contactEmail: string | null;
  reminders: ReminderSchedule[];
  legacyReminderDate: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IDEMPOTENCY_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isContactType(value: unknown): value is ContactType {
  return CONTACT_TYPES.includes(value as ContactType);
}

function isReminderMonths(value: unknown): value is ReminderMonths {
  return REMINDER_MONTHS.includes(value as ReminderMonths);
}

function parseReminderMonths(value: unknown): ReminderMonths | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : Number.NaN;

  return isReminderMonths(parsed) ? parsed : null;
}

function addMonthsClamped(date: Date, months: ReminderMonths): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const targetMonthIndex = month + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  const targetDay = Math.min(day, lastDayOfTargetMonth);

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

export function calculateReminderDate(
  months: ReminderMonths,
  from: Date = new Date(),
): string {
  return addMonthsClamped(from, months).toISOString().slice(0, 10);
}

export function calculateReminderSchedule(
  months: ReminderMonths,
  from: Date = new Date(),
  testIntervalMinutes?: number,
): ReminderSchedule {
  const scheduled =
    testIntervalMinutes && testIntervalMinutes > 0
      ? new Date(from.getTime() + testIntervalMinutes * 60 * 1000)
      : addMonthsClamped(from, months);

  return {
    months,
    reminderDate: scheduled.toISOString().slice(0, 10),
    scheduledAt: scheduled.toISOString(),
  };
}

export function validateWishJourneyInput(
  input: unknown,
  now: Date = new Date(),
  testIntervalMinutes?: number,
): ValidationResult<WishJourneyInput> {
  if (!isRecord(input)) {
    return { ok: false, error: "Please check the Wish Journey and try again." };
  }

  if (typeof input.wishContent !== "string" || !input.wishContent.trim()) {
    return { ok: false, error: "Wish cannot be empty." };
  }

  if (input.wishContent.trim().length > MAX_WISH_CONTENT_LENGTH) {
    return {
      ok: false,
      error: `Wish must be ${MAX_WISH_CONTENT_LENGTH} characters or fewer.`,
    };
  }

  if (
    typeof input.idempotencyKey !== "string" ||
    !IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey)
  ) {
    return { ok: false, error: "Unable to verify this save request." };
  }

  if (typeof input.name !== "string" || !input.name.trim()) {
    return { ok: false, error: "Name cannot be empty." };
  }

  if (!isContactType(input.contactType)) {
    return { ok: false, error: "Choose a valid contact type." };
  }

  let contactEmail: string | null = null;

  if (input.contactType === "no_email") {
    if (
      input.contactEmail !== undefined &&
      input.contactEmail !== null &&
      input.contactEmail !== ""
    ) {
      return {
        ok: false,
        error: "Contact email must be empty when no email is selected.",
      };
    }
  } else {
    if (typeof input.contactEmail !== "string") {
      return { ok: false, error: "Enter a valid email address." };
    }

    contactEmail = input.contactEmail.trim();

    if (!EMAIL_PATTERN.test(contactEmail)) {
      return { ok: false, error: "Enter a valid email address." };
    }
  }

  const rawReminders = Array.isArray(input.reminders)
    ? input.reminders
    : input.reminder !== undefined
      ? [input.reminder]
      : [];

  if (rawReminders.length === 0) {
    return {
      ok: false,
      error: "Choose at least one reminder: 1, 3, 6, or 12 months.",
    };
  }

  const selectedMonths = new Set<ReminderMonths>();

  for (const value of rawReminders) {
    const months = parseReminderMonths(value);

    if (months === null) {
      return {
        ok: false,
        error: "Choose only 1, 3, 6, or 12 months for reminders.",
      };
    }

    selectedMonths.add(months);
  }

  const reminders = [...selectedMonths]
    .sort((left, right) => left - right)
    .map((months) => calculateReminderSchedule(months, now, testIntervalMinutes));

  return {
    ok: true,
    data: {
      idempotencyKey: input.idempotencyKey,
      name: input.name.trim(),
      contactType: input.contactType,
      contactEmail,
      reminders,
      legacyReminderDate: reminders[0].reminderDate,
    },
  };
}

export type ExistingReminder = {
  reminderDate: string;
  status: string;
};

export function calculateNextReminderSchedule(
  months: ReminderMonths,
  existingReminders: ExistingReminder[],
  from: Date = new Date(),
): ReminderSchedule {
  const latestPending = existingReminders
    .filter((reminder) => reminder.status === "pending")
    .sort((left, right) =>
      right.reminderDate.localeCompare(left.reminderDate),
    )[0];
  const baseDate = latestPending
    ? new Date(`${latestPending.reminderDate}T12:00:00.000Z`)
    : from;
  const existingDates = new Set(
    existingReminders.map((reminder) => reminder.reminderDate),
  );
  let schedule = calculateReminderSchedule(months, baseDate);

  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (!existingDates.has(schedule.reminderDate)) {
      return schedule;
    }

    const previousDate = new Date(`${schedule.reminderDate}T12:00:00.000Z`);
    schedule = calculateReminderSchedule(months, previousDate);
  }

  throw new Error("Unable to find an available reminder date.");
}

