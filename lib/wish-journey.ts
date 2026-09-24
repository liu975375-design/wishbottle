import type { ValidationResult } from "./validation";

export const CONTACT_TYPES = [
  "own_email",
  "parent_carer_email",
  "no_email",
] as const;

export const REMINDER_MONTHS = [1, 3, 6, 12] as const;
export const CUSTOM_REMINDER_MONTHS = 0 as const;
export const MAX_WISH_CONTENT_LENGTH = 200;

const LONDON_TIME_ZONE = "Europe/London";
const LONDON_REMINDER_HOUR = 9;

export type ContactType = (typeof CONTACT_TYPES)[number];
export type ReminderMonths = (typeof REMINDER_MONTHS)[number];
export type ReminderMonthValue =
  | ReminderMonths
  | typeof CUSTOM_REMINDER_MONTHS;

export type MonthlyReminderSchedule = {
  months: ReminderMonths;
  reminderDate: string;
  scheduledAt: string;
};

export type CustomReminderSchedule = {
  months: typeof CUSTOM_REMINDER_MONTHS;
  reminderDate: string;
  scheduledAt: string;
};

export type ReminderSchedule =
  | MonthlyReminderSchedule
  | CustomReminderSchedule;

export type WishJourneyInput = {
  idempotencyKey: string;
  name: string;
  contactType: ContactType;
  contactEmail: string | null;
  reminders: ReminderSchedule[];
  legacyReminderDate: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
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

function getDatePartsInTimeZone(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
  };
}

function formatDateParts(parts: {
  year: number;
  month: number;
  day: number;
}): string {
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

export function getDateInTimeZone(
  date: Date = new Date(),
  timeZone: string = LONDON_TIME_ZONE,
): string {
  return formatDateParts(getDatePartsInTimeZone(date, timeZone));
}

export function getTomorrowInTimeZone(
  date: Date = new Date(),
  timeZone: string = LONDON_TIME_ZONE,
): string {
  const parts = getDatePartsInTimeZone(date, timeZone);
  const tomorrow = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + 1),
  );

  return tomorrow.toISOString().slice(0, 10);
}

function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function getTimeZoneOffsetMilliseconds(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const representedAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  );

  return representedAsUtc - date.getTime();
}

export function londonDateAtNineToUtc(dateOnly: string): string {
  if (!isValidDateOnly(dateOnly)) {
    throw new Error("Invalid date.");
  }

  const [year, month, day] = dateOnly.split("-").map(Number);
  const wallClockAsUtc = Date.UTC(
    year,
    month - 1,
    day,
    LONDON_REMINDER_HOUR,
    0,
    0,
    0,
  );
  let candidate = wallClockAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offset = getTimeZoneOffsetMilliseconds(
      new Date(candidate),
      LONDON_TIME_ZONE,
    );
    const adjusted = wallClockAsUtc - offset;

    if (adjusted === candidate) {
      break;
    }

    candidate = adjusted;
  }

  return new Date(candidate).toISOString();
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
): MonthlyReminderSchedule {
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

export function calculateCustomReminderSchedule(
  reminderDate: string,
  from: Date = new Date(),
  testIntervalMinutes?: number,
): CustomReminderSchedule {
  if (testIntervalMinutes && testIntervalMinutes > 0) {
    const scheduled = new Date(
      from.getTime() + testIntervalMinutes * 60 * 1000,
    );

    return {
      months: CUSTOM_REMINDER_MONTHS,
      reminderDate: scheduled.toISOString().slice(0, 10),
      scheduledAt: scheduled.toISOString(),
    };
  }

  return {
    months: CUSTOM_REMINDER_MONTHS,
    reminderDate,
    scheduledAt: londonDateAtNineToUtc(reminderDate),
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
  const rawCustomReminderDate = input.customReminderDate;
  let customReminderValue = "";
  let customReminderDate: string | null = null;

  if (
    rawCustomReminderDate !== undefined &&
    rawCustomReminderDate !== null &&
    rawCustomReminderDate !== ""
  ) {
    if (typeof rawCustomReminderDate !== "string") {
      return {
        ok: false,
        error: "Custom Date must be a valid future date.",
      };
    }

    customReminderValue = rawCustomReminderDate.trim();
    if (
      !isValidDateOnly(customReminderValue) ||
      customReminderValue <= getDateInTimeZone(now)
    ) {
      return {
        ok: false,
        error: "Custom Date must be a valid future date.",
      };
    }

    customReminderDate = customReminderValue;
  }

  if (rawReminders.length === 0 && !customReminderDate) {
    return {
      ok: false,
      error: "Choose at least one reminder or a Custom Date.",
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

  const reminders: ReminderSchedule[] = [...selectedMonths]
    .sort((left, right) => left - right)
    .map((months) => calculateReminderSchedule(months, now, testIntervalMinutes));

  if (customReminderDate) {
    reminders.push(
      calculateCustomReminderSchedule(
        customReminderDate,
        now,
        testIntervalMinutes,
      ),
    );
  }

  reminders.sort(
    (left, right) =>
      left.reminderDate.localeCompare(right.reminderDate) ||
      left.months - right.months,
  );

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
): MonthlyReminderSchedule {
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

