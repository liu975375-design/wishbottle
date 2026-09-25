import { afterEach, describe, expect, it, vi } from "vitest";

import { EmailProviderError } from "../lib/email";
import {
  getPinResetTokenState,
  logPinResetEmailFailure,
  maskEmailAddress,
} from "../lib/pin-reset";
import { normalizeEmail } from "../lib/verification";

describe("PIN reset helpers", () => {
  const now = new Date("2026-09-25T00:00:00.000Z");

  it("masks recipient emails without exposing the full address", () => {
    expect(maskEmailAddress("john@example.com")).toBe("j***@example.com");
    expect(maskEmailAddress("a@example.com")).toBe("a***@example.com");
    expect(maskEmailAddress("not-an-email")).toBe("[invalid-email]");
  });

  it("reuses existing email normalization for comparisons", () => {
    expect(normalizeEmail("  John@Example.COM  ")).toBe("john@example.com");
  });

  it("classifies valid, expired, used, and invalid reset tokens", () => {
    expect(
      getPinResetTokenState(
        {
          expires_at: "2026-09-25T01:00:00.000Z",
          used_at: null,
        },
        now,
      ),
    ).toBe("valid");
    expect(
      getPinResetTokenState(
        {
          expires_at: "2026-09-24T23:59:59.000Z",
          used_at: null,
        },
        now,
      ),
    ).toBe("expired");
    expect(
      getPinResetTokenState(
        {
          expires_at: "2026-09-26T00:00:00.000Z",
          used_at: "2026-09-25T00:00:00.000Z",
        },
        now,
      ),
    ).toBe("used");
    expect(getPinResetTokenState(null, now)).toBe("invalid");
  });
});

describe("PIN reset email failure logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs structured provider details without secrets", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const providerBody = JSON.stringify({
      name: "validation_error",
      message: "Rejected re_verysecretkey for j***@example.com",
      statusCode: 422,
    });
    const error = new EmailProviderError({
      status: 422,
      code: "validation_error",
      message: "Provider rejected john@example.com",
      responseBody: providerBody,
    });

    logPinResetEmailFailure(
      {
        route: "/api/pin-reset/request",
        wishId: "wish-test-id",
        email: "john@example.com",
      },
      error,
    );

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const [event, context] = consoleSpy.mock.calls[0];
    expect(event).toBe("[PIN Reset] Failed to send reset email");
    expect(context).toMatchObject({
      route: "/api/pin-reset/request",
      wishId: "wish-test-id",
      email: "j***@example.com",
      provider: "resend",
      providerStatus: 422,
      errorCode: "validation_error",
    });

    const serialized = JSON.stringify(context);
    expect(serialized).not.toContain("john@example.com");
    expect(serialized).not.toContain("re_verysecretkey");
    expect(serialized).not.toContain("raw-secret-token");
    expect(serialized).toContain("timestamp");
  });
});
