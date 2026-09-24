import Link from "next/link";

import { WishBottleIllustration } from "./WishBottleIllustration";

type EmailVerificationSummary = {
  required: boolean;
  verified: boolean;
  sent: boolean;
  cooldown: boolean;
};

type WishConfirmationProps = {
  name: string;
  wishCode: string;
  createdAt: string;
  reminder: string;
  contactType: "" | "own_email" | "parent_carer_email" | "no_email";
  contactEmail: string | null;
  emailVerification: EmailVerificationSummary;
  onReset: () => void;
  onResendVerification: () => void;
  isResendingVerification: boolean;
  verificationMessage: string | null;
  verificationError: string | null;
};

export function WishConfirmation({
  name,
  wishCode,
  createdAt,
  reminder,
  contactType,
  contactEmail,
  emailVerification,
  onReset,
  onResendVerification,
  isResendingVerification,
  verificationMessage,
  verificationError,
}: WishConfirmationProps) {
  const savedDate = new Date(createdAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <section aria-live="polite" className="confirmation-block">
      <div className="confirmation-ribbon">Your wish is saved</div>
      <div className="confirmation-card">
        <WishBottleIllustration className="confirmation-art" />

        <div className="confirmation-heading">
          <p className="eyebrow">A little light, kept safe</p>
          <h1>Your wish has been saved!</h1>
          <p>
            Keep your Wish Code and PIN close so you can find this wish again.
          </p>
        </div>

        <div className="confirmation-code-hero">
          <p>Your Wish Code</p>
          <output className="wish-code">{wishCode}</output>
          <span>Take a screenshot or write it down somewhere safe.</span>
        </div>

        {contactType === "no_email" ? (
          <p className="status status-error">
            Without an email, we cannot help recover your PIN later.
          </p>
        ) : emailVerification.verified ? (
          <p className="status status-success">
            This email is already verified.
          </p>
        ) : emailVerification.sent ? (
          <p className="status status-success">
            We sent a verification link to {contactEmail}. Verify it to enable
            reminders and PIN recovery.
          </p>
        ) : (
          <p className="status status-error">
            We could not send the verification email. You can try again below.
          </p>
        )}

        {contactType !== "no_email" && !emailVerification.verified ? (
          <button
            className="button button-secondary"
            disabled={isResendingVerification}
            onClick={onResendVerification}
            type="button"
          >
            {isResendingVerification
              ? "Sending..."
              : "Resend verification email"}
          </button>
        ) : null}

        {verificationMessage ? (
          <p className="status status-success" role="status">
            {verificationMessage}
          </p>
        ) : null}

        {verificationError ? (
          <p className="status status-error" role="alert">
            {verificationError}
          </p>
        ) : null}

        <dl className="confirmation-meta-grid">
          <div>
            <dt>Name</dt>
            <dd>{name}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{savedDate}</dd>
          </div>
          <div>
            <dt>Reminder</dt>
            <dd>{reminder}</dd>
          </div>
        </dl>

        <div className="confirmation-actions">
          <Link className="button button-primary" href="/find">
            View My Wish
          </Link>
          <button
            className="button button-secondary"
            onClick={onReset}
            type="button"
          >
            Make Another Wish
          </button>
        </div>
      </div>
      <p className="confirmation-note">Good things take time.</p>
    </section>
  );
}

