import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EmailConfigurationError,
  sendReminderEmail,
} from "../lib/email";

describe("Reminder email", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.REMINDER_FROM_EMAIL = "WishBottle <test@example.com>";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RESEND_API_KEY;
    delete process.env.REMINDER_FROM_EMAIL;
  });

  it("sends the return link without PIN or internal database data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email-test-id" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendReminderEmail({
        to: "mary@example.com",
        name: "Mary",
        wishCode: "MARY22092026",
        returnUrl: "https://wishbottle.example/return/secret-token",
      }),
    ).resolves.toBe("email-test-id");

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const emailBody = String(request.body);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({ method: "POST" }),
    );
    expect(emailBody).toContain("MARY22092026");
    expect(emailBody).toContain("secret-token");
    expect(emailBody).not.toMatch(/pin_hash|"pin"|service_role/i);
  });

  it("fails clearly when email configuration is missing", async () => {
    delete process.env.RESEND_API_KEY;

    await expect(
      sendReminderEmail({
        to: "mary@example.com",
        name: "Mary",
        wishCode: "MARY22092026",
        returnUrl: "https://wishbottle.example/return/secret-token",
      }),
    ).rejects.toBeInstanceOf(EmailConfigurationError);
  });
});
