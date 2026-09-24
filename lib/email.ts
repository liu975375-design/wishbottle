export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

type ReminderEmailInput = {
  to: string;
  name: string;
  wishCode: string;
  returnUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function assertEmailConfiguration(): void {
  if (!process.env.RESEND_API_KEY || !process.env.REMINDER_FROM_EMAIL) {
    throw new EmailConfigurationError(
      "RESEND_API_KEY and REMINDER_FROM_EMAIL are required.",
    );
  }
}

export async function sendReminderEmail({
  to,
  name,
  wishCode,
  returnUrl,
}: ReminderEmailInput): Promise<string> {
  assertEmailConfiguration();

  const safeName = escapeHtml(name);
  const safeWishCode = escapeHtml(wishCode);
  const safeReturnUrl = escapeHtml(returnUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.REMINDER_FROM_EMAIL,
      to: [to],
      subject: "Your WishBottle wish is ready to revisit",
      html: `
        <div style="font-family: Arial, sans-serif; color: #202d49; line-height: 1.6;">
          <h1 style="font-family: Georgia, serif;">Your wish is ready to revisit.</h1>
          <p>Hi ${safeName},</p>
          <p>Your WishBottle wish is ready to revisit. Open the secure link below to see it again.</p>
          <p><a href="${safeReturnUrl}" style="display: inline-block; padding: 14px 20px; border-radius: 999px; background: #ef6b77; color: #ffffff; text-decoration: none; font-weight: 700;">Return to My Wish</a></p>
          <p style="color: #536079; font-size: 13px;">Wish Code: ${safeWishCode}</p>
          <p style="color: #536079; font-size: 13px;">This link is personal and should not be shared.</p>
        </div>
      `,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const payload = (await response.json().catch(() => null)) as {
    id?: unknown;
    message?: unknown;
  } | null;

  if (!response.ok || typeof payload?.id !== "string") {
    throw new Error(
      typeof payload?.message === "string"
        ? payload.message
        : `Email provider returned HTTP ${response.status}.`,
    );
  }

  return payload.id;
}
type EmailVerificationInput = {
  to: string;
  name: string;
  verificationUrl: string;
};

type PinResetEmailInput = {
  to: string;
  name: string;
  resetUrl: string;
};

export async function sendEmailVerificationEmail({
  to,
  name,
  verificationUrl,
}: EmailVerificationInput): Promise<string> {
  assertEmailConfiguration();

  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(verificationUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.REMINDER_FROM_EMAIL,
      to: [to],
      subject: "Verify your WishBottle email",
      html: `
        <div style="font-family: Arial, sans-serif; color: #202d49; line-height: 1.6;">
          <h1 style="font-family: Georgia, serif;">Verify your email</h1>
          <p>Hi ${safeName},</p>
          <p>Confirm this email so we can send future WishBottle reminders and help you recover your PIN.</p>
          <p><a href="${safeUrl}" style="display: inline-block; padding: 14px 20px; border-radius: 999px; background: #ef6b77; color: #ffffff; text-decoration: none; font-weight: 700;">Verify my email</a></p>
          <p style="color: #536079; font-size: 13px;">If you did not create this Wish, you can ignore this email.</p>
        </div>
      `,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await response.json().catch(() => null)) as {
    id?: unknown;
    message?: unknown;
  } | null;

  if (!response.ok || typeof payload?.id !== "string") {
    throw new Error(
      typeof payload?.message === "string"
        ? payload.message
        : `Email provider returned HTTP ${response.status}.`,
    );
  }

  return payload.id;
}

export async function sendPinResetEmail({
  to,
  name,
  resetUrl,
}: PinResetEmailInput): Promise<string> {
  assertEmailConfiguration();

  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(resetUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.REMINDER_FROM_EMAIL,
      to: [to],
      subject: "Reset your WishBottle PIN",
      html: `
        <div style="font-family: Arial, sans-serif; color: #202d49; line-height: 1.6;">
          <h1 style="font-family: Georgia, serif;">Reset your PIN</h1>
          <p>Hi ${safeName},</p>
          <p>Use the secure link below to choose a new 4–6 digit PIN.</p>
          <p><a href="${safeUrl}" style="display: inline-block; padding: 14px 20px; border-radius: 999px; background: #ef6b77; color: #ffffff; text-decoration: none; font-weight: 700;">Set a new PIN</a></p>
          <p style="color: #536079; font-size: 13px;">If you did not request this, you can ignore this email. Your current PIN has not changed.</p>
        </div>
      `,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await response.json().catch(() => null)) as {
    id?: unknown;
    message?: unknown;
  } | null;

  if (!response.ok || typeof payload?.id !== "string") {
    throw new Error(
      typeof payload?.message === "string"
        ? payload.message
        : `Email provider returned HTTP ${response.status}.`,
    );
  }

  return payload.id;
}

