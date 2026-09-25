"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type EmailVerificationStatus =
  | "not_required"
  | "already_verified"
  | "sent"
  | "cooldown"
  | "failed";

type EmailVerificationSummary = {
  required: boolean;
  status: EmailVerificationStatus;
  verified: boolean;
  sent: boolean;
  cooldown: boolean;
  retryable: boolean;
};

type WishConfirmationProps = {
  wishSaved: boolean;
  reminderScheduled: boolean;
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
  verificationError: string | null;
};

type StatusTone = "success" | "pending" | "failed" | "neutral";

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.6 2.7L16.5 9" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect height="15" rx="2.5" width="16" x="4" y="5.5" />
      <path d="M8 3.5v4M16 3.5v4M4 10h16M8.5 14l2 2 4-4" />
    </svg>
  );
}

function MailIcon({ tone }: { tone: StatusTone }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect height="13" rx="2.5" width="17" x="3.5" y="5.5" />
      <path d="m5 8 7 5 7-5" />
      {tone === "failed" ? <path d="M18.5 16.5 21 19m0-2.5-2.5 2.5" /> : null}
    </svg>
  );
}

function StatusItem({
  description,
  icon,
  title,
  tone,
}: {
  description: string;
  icon: "check" | "calendar" | "mail";
  title: string;
  tone: StatusTone;
}) {
  return (
    <div className={`confirmation-status-item is-${tone}`}>
      <span className="confirmation-status-icon" aria-hidden="true">
        {icon === "check" ? <CheckIcon /> : null}
        {icon === "calendar" ? <CalendarIcon /> : null}
        {icon === "mail" ? <MailIcon tone={tone} /> : null}
      </span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  );
}

export function WishConfirmation({
  wishSaved,
  reminderScheduled,
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
  verificationError,
}: WishConfirmationProps) {
  const [copied, setCopied] = useState(false);
  const copyResetTimerRef = useRef<number | null>(null);
  const wishCodeRef = useRef<HTMLOutputElement | null>(null);
  const savedDate = new Date(createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  useEffect(
    () => () => {
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    },
    [],
  );

  useLayoutEffect(() => {
    const output = wishCodeRef.current;

    if (!output) {
      return;
    }

    const fitWishCode = () => {
      output.style.fontSize = "18px";

      const availableWidth = output.clientWidth;
      const requiredWidth = output.scrollWidth;

      if (availableWidth > 0 && requiredWidth > availableWidth) {
        const fittedSize = Math.max(10, 18 * (availableWidth / requiredWidth));
        output.style.fontSize = `${Math.floor(fittedSize * 10) / 10}px`;
      }
    };

    fitWishCode();
    window.addEventListener("resize", fitWishCode);

    return () => window.removeEventListener("resize", fitWishCode);
  }, [wishCode]);

  async function copyWishCode() {
    try {
      await navigator.clipboard.writeText(wishCode);
    } catch {
      const temporaryInput = document.createElement("textarea");
      temporaryInput.value = wishCode;
      temporaryInput.setAttribute("readonly", "");
      temporaryInput.style.position = "fixed";
      temporaryInput.style.opacity = "0";
      document.body.appendChild(temporaryInput);
      temporaryInput.select();
      document.execCommand("copy");
      temporaryInput.remove();
    }

    setCopied(true);

    if (copyResetTimerRef.current !== null) {
      window.clearTimeout(copyResetTimerRef.current);
    }

    copyResetTimerRef.current = window.setTimeout(() => setCopied(false), 2_000);
  }

  const emailState =
    contactType === "no_email" || emailVerification.status === "not_required"
      ? {
          description:
            "You can still find this wish later with your Wish Code and PIN.",
          title: "Email not provided",
          tone: "neutral" as StatusTone,
        }
      : emailVerification.verified ||
          emailVerification.status === "already_verified"
        ? {
            description: "This email address has been verified.",
            title: "Email verified",
            tone: "success" as StatusTone,
          }
        : emailVerification.status === "sent" ||
            emailVerification.status === "cooldown"
          ? {
              description: `A verification link was sent to ${contactEmail}. Your email stays pending until you open that link.`,
              title: "Email verification pending",
              tone: "pending" as StatusTone,
            }
          : {
              description:
                "We couldn't send your verification email. Please try again.",
              title: "Email verification failed",
              tone: "failed" as StatusTone,
            };

  return (
    <section aria-live="polite" className="confirmation-block">
      <div className="confirmation-scene">
        <Image
          alt=""
          className="confirmation-scene-image"
          fill
          sizes="(max-width: 768px) 100vw, 760px"
          src="/assets/saved-wish-scene-v2.jpg"
        />
      </div>

      <div className="confirmation-copy">
        <h1>Your wish is safely stored.</h1>
        <p className="confirmation-lede">
          Keep your Wish Code and PIN safe.
          <br />
          We&apos;ll remind you at the chosen time.
        </p>
        <p className="confirmation-wish-name">{name}</p>

        <div className="confirmation-details-card">
          <div className="confirmation-code-detail">
            <div className="confirmation-code-value">
              <span>Wish Code</span>
              <output ref={wishCodeRef}>{wishCode}</output>
            </div>
            <button
              aria-live="polite"
              className={`wish-code-copy ${copied ? "is-copied" : ""}`}
              onClick={copyWishCode}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20">
                {copied ? (
                  <path d="m4.5 10.5 3.3 3.2 7.7-7.4" />
                ) : (
                  <>
                    <rect height="9" rx="1.8" width="9" x="6.5" y="6.5" />
                    <path d="M13.5 6.5v-2A1.5 1.5 0 0 0 12 3H5.5A1.5 1.5 0 0 0 4 4.5V11a1.5 1.5 0 0 0 1.5 1.5h1" />
                  </>
                )}
              </svg>
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>

          <div className="confirmation-saved-date">
            <span>Saved Date</span>
            <time dateTime={createdAt}>{savedDate}</time>
          </div>
        </div>
        <p className="confirmation-code-hint">
          Keep your Wish Code safe. You will need it to find your wish later.
        </p>

        <div className="confirmation-status-panel" aria-label="Save status">
          <StatusItem
            description={
              wishSaved
                ? "Your wish is safely stored."
                : "Your wish could not be saved. Please try again."
            }
            icon="check"
            title={wishSaved ? "Wish saved" : "Wish not saved"}
            tone={wishSaved ? "success" : "failed"}
          />
          <StatusItem
            description={
              reminderScheduled
                ? `We'll bring this wish back on ${reminder}.`
                : "The reminder was not created."
            }
            icon="calendar"
            title={
              reminderScheduled ? "Reminder scheduled" : "Reminder not scheduled"
            }
            tone={reminderScheduled ? "success" : "failed"}
          />
          <StatusItem
            description={emailState.description}
            icon="mail"
            title={emailState.title}
            tone={emailState.tone}
          />
        </div>

        {contactType !== "no_email" && !emailVerification.verified ? (
          <button
            className="button-link resend-link"
            disabled={isResendingVerification}
            onClick={onResendVerification}
            type="button"
          >
            {isResendingVerification ? "Sending..." : "Resend verification email"}
          </button>
        ) : null}

        {verificationError ? (
          <p className="status status-error" role="alert">
            {verificationError}
          </p>
        ) : null}

        <div className="confirmation-actions">
          <button className="button button-primary" onClick={onReset} type="button">
            Return Home
            <span aria-hidden="true">›</span>
          </button>
          <Link className="button button-secondary" href="/find">
            View My Wish
            <span aria-hidden="true">›</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
