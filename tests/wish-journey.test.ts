import { describe, expect, it } from "vitest";

import {
  calculateNextReminderSchedule,
  calculateReminderDate,
  validateWishJourneyInput,
} from "../lib/wish-journey";

const BASE_DATE = new Date("2026-01-31T12:00:00.000Z");
const IDEMPOTENCY_KEY = "123e4567-e89b-42d3-a456-426614174000";

describe("Release 2 Wish Journey validation", () => {
  it("calculates month reminders while clamping to the last valid day", () => {
    expect(calculateReminderDate(1, BASE_DATE)).toBe("2026-02-28");
    expect(calculateReminderDate(3, BASE_DATE)).toBe("2026-04-30");
    expect(calculateReminderDate(6, BASE_DATE)).toBe("2026-07-31");
    expect(calculateReminderDate(12, BASE_DATE)).toBe("2027-01-31");
  });

  it("creates one schedule per selected reminder", () => {
    const result = validateWishJourneyInput(
      {
        wishContent: "A peaceful year",
        idempotencyKey: IDEMPOTENCY_KEY,
        name: "Mary",
        contactType: "own_email",
        contactEmail: "mary@example.com",
        reminders: [3, 1, 12],
      },
      BASE_DATE,
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data.reminders.map((item) => item.months)).toEqual([
        1, 3, 12,
      ]);
      expect(result.data.reminders.map((item) => item.reminderDate)).toEqual([
        "2026-02-28",
        "2026-04-30",
        "2027-01-31",
      ]);
      expect(result.data.legacyReminderDate).toBe("2026-02-28");
    }
  });

  it("deduplicates reminder months and rejects an empty selection", () => {
    const duplicate = validateWishJourneyInput(
      {
        wishContent: "A wish",
        idempotencyKey: IDEMPOTENCY_KEY,
        name: "Mary",
        contactType: "no_email",
        contactEmail: null,
        reminders: [3, 3],
      },
      BASE_DATE,
    );

    expect(duplicate.ok).toBe(true);

    if (duplicate.ok) {
      expect(duplicate.data.reminders).toHaveLength(1);
    }

    expect(
      validateWishJourneyInput(
        {
          wishContent: "A wish",
          idempotencyKey: IDEMPOTENCY_KEY,
          name: "Mary",
          contactType: "no_email",
          contactEmail: null,
          reminders: [],
        },
        BASE_DATE,
      ),
    ).toEqual({
      ok: false,
      error: "Choose at least one reminder: 1, 3, 6, or 12 months.",
    });
  });

  it("stores own and parent/carer emails as contact details", () => {
    const own = validateWishJourneyInput(
      {
        wishContent: "A wish",
        idempotencyKey: IDEMPOTENCY_KEY,
        name: "  Mary  ",
        contactType: "own_email",
        contactEmail: "  mary@example.com  ",
        reminders: [1],
      },
      BASE_DATE,
    );
    const parent = validateWishJourneyInput(
      {
        wishContent: "A wish",
        idempotencyKey: IDEMPOTENCY_KEY,
        name: "Sam",
        contactType: "parent_carer_email",
        contactEmail: "carer@example.com",
        reminders: [6],
      },
      BASE_DATE,
    );

    expect(own.ok && own.data.name).toBe("Mary");
    expect(own.ok && own.data.contactEmail).toBe("mary@example.com");
    expect(parent.ok && parent.data.contactType).toBe("parent_carer_email");
    expect(parent.ok && parent.data.contactEmail).toBe("carer@example.com");
  });

  it("stores null email for no_email", () => {
    const result = validateWishJourneyInput(
      {
        wishContent: "A wish",
        idempotencyKey: IDEMPOTENCY_KEY,
        name: "Alex",
        contactType: "no_email",
        contactEmail: null,
        reminders: [1],
      },
      BASE_DATE,
    );

    expect(result.ok && result.data.contactEmail).toBeNull();
  });

  it("rejects custom dates, invalid emails, long wishes, and invalid keys", () => {
    expect(
      validateWishJourneyInput(
        {
          wishContent: "A wish",
          idempotencyKey: IDEMPOTENCY_KEY,
          name: "Alex",
          contactType: "no_email",
          contactEmail: null,
          reminders: ["custom"],
        },
        BASE_DATE,
      ),
    ).toEqual({
      ok: false,
      error: "Choose only 1, 3, 6, or 12 months for reminders.",
    });

    expect(
      validateWishJourneyInput(
        {
          wishContent: "A wish",
          idempotencyKey: IDEMPOTENCY_KEY,
          name: "Alex",
          contactType: "own_email",
          contactEmail: "not-an-email",
          reminders: [3],
        },
        BASE_DATE,
      ),
    ).toEqual({ ok: false, error: "Enter a valid email address." });

    expect(
      validateWishJourneyInput(
        {
          wishContent: "x".repeat(201),
          idempotencyKey: IDEMPOTENCY_KEY,
          name: "Alex",
          contactType: "no_email",
          contactEmail: null,
          reminders: [3],
        },
        BASE_DATE,
      ),
    ).toEqual({
      ok: false,
      error: "Wish must be 200 characters or fewer.",
    });

    expect(
      validateWishJourneyInput(
        {
          wishContent: "A wish",
          idempotencyKey: "not-a-uuid",
          name: "Alex",
          contactType: "no_email",
          contactEmail: null,
          reminders: [3],
        },
        BASE_DATE,
      ),
    ).toEqual({ ok: false, error: "Unable to verify this save request." });
  });

  it("bases remind_later on the latest pending reminder and avoids duplicate dates", () => {
    const nextReminder = calculateNextReminderSchedule(
      3,
      [{ reminderDate: "2026-12-22", status: "pending" }],
      new Date("2026-09-22T12:00:00.000Z"),
    );

    expect(nextReminder).toMatchObject({
      months: 3,
      reminderDate: "2027-03-22",
    });

    const skippedExistingDate = calculateNextReminderSchedule(
      3,
      [
        { reminderDate: "2026-12-22", status: "pending" },
        { reminderDate: "2027-03-22", status: "sent" },
      ],
      new Date("2026-09-22T12:00:00.000Z"),
    );

    expect(skippedExistingDate.reminderDate).toBe("2027-06-22");
  });

  it("uses the current date when there is no reminder history", () => {
    const nextReminder = calculateNextReminderSchedule(
      3,
      [],
      new Date("2026-09-22T12:00:00.000Z"),
    );

    expect(nextReminder.reminderDate).toBe("2026-12-22");
  });
});



