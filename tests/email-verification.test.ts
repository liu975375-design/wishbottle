import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { EmailProviderError } from "../lib/email";
import { logEmailVerificationFailure } from "../lib/email-verification-service";
import { getEmailVerificationTokenState } from "../lib/verification";

describe("Email verification token state", () => {
  const now = new Date("2026-09-25T00:00:00.000Z");

  it("classifies valid, expired, used, and invalid tokens", () => {
    expect(
      getEmailVerificationTokenState(
        {
          expires_at: "2026-09-25T01:00:00.000Z",
          used_at: null,
        },
        now,
      ),
    ).toBe("valid");
    expect(
      getEmailVerificationTokenState(
        {
          expires_at: "2026-09-24T23:59:59.000Z",
          used_at: null,
        },
        now,
      ),
    ).toBe("expired");
    expect(
      getEmailVerificationTokenState(
        {
          expires_at: "2026-09-26T00:00:00.000Z",
          used_at: "2026-09-25T00:00:00.000Z",
        },
        now,
      ),
    ).toBe("used");
    expect(getEmailVerificationTokenState(null, now)).toBe("invalid");
  });
});

describe("Email verification failure logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs provider details while masking email, API keys, and raw tokens", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const providerResponse = JSON.stringify({
      name: "validation_error",
      message:
        "Cannot send to person@example.com with re_verysecretkey at /verify-email/raw-secret-token",
      statusCode: 422,
    });
    const error = new EmailProviderError({
      status: 422,
      code: "validation_error",
      message: "Resend rejected person@example.com",
      responseBody: providerResponse,
    });

    logEmailVerificationFailure(
      {
        apiRoute: "/api/wishes",
        stage: "provider_send",
        wishId: "wish-test-id",
        email: "person@example.com",
      },
      error,
    );

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const [event, context] = consoleSpy.mock.calls[0];
    expect(event).toBe(
      "[Email Verification] Failed to send verification email",
    );
    expect(context).toMatchObject({
      apiRoute: "/api/wishes",
      stage: "provider_send",
      wishId: "wish-test-id",
      email: "pe***@example.com",
      provider: "resend",
      providerStatus: 422,
      errorCode: "validation_error",
    });

    const serialized = JSON.stringify(context);
    expect(serialized).not.toContain("person@example.com");
    expect(serialized).not.toContain("re_verysecretkey");
    expect(serialized).not.toContain("raw-secret-token");
    expect(serialized).toContain("responseBody");
    expect(serialized).toContain("timestamp");
  });
});

describe("Reminder eligibility migration", () => {
  const migration = readFileSync(
    "supabase/migrations/20260923020000_add_email_verification_and_pin_reset.sql",
    "utf8",
  );

  it("requires a verified email before claiming due reminders", () => {
    expect(migration).toMatch(/w\.email_verified_at is not null/i);
  });

  it("keeps verification tokens single-use and time-limited", () => {
    expect(migration).toMatch(/t\.used_at is null/i);
    expect(migration).toMatch(/t\.expires_at > v_verified_at/i);
    expect(migration).toMatch(/set used_at = v_verified_at/i);
  });
});
