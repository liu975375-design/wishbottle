"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";

import {
  getDateInTimeZone,
  getTomorrowInTimeZone,
} from "@/lib/wish-journey";

import { StepIndicator } from "./StepIndicator";
import { WishBottleIllustration } from "./WishBottleIllustration";
import { WishConfirmation } from "./WishConfirmation";

type Step = 1 | 2 | 3 | 4 | 5;
type ContactChoice = "" | "own_email" | "parent_carer_email" | "no_email";

type EmailVerificationSummary = {
  required: boolean;
  verified: boolean;
  sent: boolean;
  cooldown: boolean;
};

type CreateSuccess = {
  wishCode: string;
  wishContent: string;
  createdAt: string;
  contactEmail: string | null;
  emailVerification: EmailVerificationSummary;
};

type ApiPayload = {
  error?: unknown;
  wishCode?: unknown;
  wishContent?: unknown;
  createdAt?: unknown;
  emailVerification?: unknown;
};

function parseEmailVerification(value: unknown): EmailVerificationSummary {
  if (typeof value !== "object" || value === null) {
    return { required: false, verified: false, sent: false, cooldown: false };
  }

  const record = value as Record<string, unknown>;

  return {
    required: record.required === true,
    verified: record.verified === true,
    sent: record.sent === true,
    cooldown: record.cooldown === true,
  };
}

const TOTAL_STEPS = 5;
const WISH_LIMIT = 200;
const PIN_PATTERN = /^\d{4,6}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REMINDER_LABELS: Record<number, string> = {
  "1": "1 month",
  "3": "3 months",
  "6": "6 months",
  "12": "12 months",
};

function createIdempotencyKey(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));

  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}
function getApiError(payload: ApiPayload | null, fallback: string): string {
  return typeof payload?.error === "string" ? payload.error : fallback;
}


export function WishJourney() {
  const [step, setStep] = useState<Step>(1);
  const [wishContent, setWishContent] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [contactChoice, setContactChoice] = useState<ContactChoice>("");
  const [contactEmail, setContactEmail] = useState("");
  const [reminderChoices, setReminderChoices] = useState<number[]>([]);
  const [customReminderEnabled, setCustomReminderEnabled] = useState(false);
  const [customReminderDate, setCustomReminderDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<CreateSuccess | null>(null);
  const [isResendingVerification, setIsResendingVerification] =
    useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(
    null,
  );
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );
  const submittingRef = useRef(false);
  const resendVerificationRef = useRef(false);
  const verificationPinRef = useRef<string | null>(null);
  const idempotencyKeyRef = useRef(createIdempotencyKey());


  const reminderText = [
    ...reminderChoices.map((months) => REMINDER_LABELS[months]),
    customReminderEnabled && customReminderDate
      ? `Custom Date: ${customReminderDate}`
      : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(", ");

  function updatePin(
    value: string,
    setter: (nextValue: string) => void,
  ): void {
    setter(value.replace(/\D/g, "").slice(0, 6));
  }

  function goBack() {
    setError(null);
    setStep((currentStep) =>
      currentStep === 1 ? 1 : ((currentStep - 1) as Step),
    );
  }

  function resetJourney() {
    setStep(1);
    setWishContent("");
    setName("");
    setPin("");
    setConfirmPin("");
    setContactChoice("");
    setContactEmail("");
    setReminderChoices([]);
    setCustomReminderEnabled(false);
    setCustomReminderDate("");
    idempotencyKeyRef.current = createIdempotencyKey();
    verificationPinRef.current = null;
    setVerificationMessage(null);
    setVerificationError(null);
    setError(null);
    setSuccess(null);
  }

  function toggleReminder(months: number): void {
    setReminderChoices((current) =>
      current.includes(months)
        ? current.filter((value) => value !== months)
        : [...current, months].sort((left, right) => left - right),
    );
  }

  function toggleCustomReminder(enabled: boolean): void {
    setCustomReminderEnabled(enabled);

    if (!enabled) {
      setCustomReminderDate("");
    }
  }

  function validateContactStep(): string | null {
    if (!contactChoice) {
      return "Choose how you would like to bring your wish back.";
    }

    if (
      (contactChoice === "own_email" ||
        contactChoice === "parent_carer_email") &&
      !EMAIL_PATTERN.test(contactEmail.trim())
    ) {
      return "Enter a valid email address.";
    }

    if (reminderChoices.length === 0 && !customReminderEnabled) {
      return "Choose at least one reminder or a Custom Date.";
    }

    if (
      customReminderEnabled &&
      (!customReminderDate || customReminderDate <= getDateInTimeZone())
    ) {
      return "Custom Date must be in the future.";
    }


    return null;
  }


  async function resendVerificationEmail() {
    if (resendVerificationRef.current || !success || !verificationPinRef.current) {
      return;
    }

    resendVerificationRef.current = true;
    setIsResendingVerification(true);
    setVerificationMessage(null);
    setVerificationError(null);

    try {
      const response = await fetch("/api/email-verification/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wishCode: success.wishCode,
          pin: verificationPinRef.current,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: unknown;
        alreadyVerified?: unknown;
        cooldown?: unknown;
      } | null;

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to resend the verification email.",
        );
      }

      if (payload?.alreadyVerified === true) {
        setSuccess((current) =>
          current
            ? {
                ...current,
                emailVerification: {
                  ...current.emailVerification,
                  verified: true,
                },
              }
            : current,
        );
        setVerificationMessage("This email is already verified.");
      } else {
        setSuccess((current) =>
          current
            ? {
                ...current,
                emailVerification: {
                  ...current.emailVerification,
                  sent: true,
                },
              }
            : current,
        );
        setVerificationMessage(
          payload?.cooldown === true
            ? "A verification email was already sent recently."
            : "Verification email sent.",
        );
      }
    } catch (resendError) {
      setVerificationError(
        resendError instanceof Error
          ? resendError.message
          : "Unable to resend the verification email.",
      );
    } finally {
      resendVerificationRef.current = false;
      setIsResendingVerification(false);
    }
  }  async function createWish() {
    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/wishes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wishContent,
          pin,
          confirmPin,
          idempotencyKey: idempotencyKeyRef.current,
          name: name.trim(),
          contactType: contactChoice,
          contactEmail:
            contactChoice === "no_email" ? null : contactEmail.trim(),
          reminders: reminderChoices,
          customReminderDate: customReminderEnabled
            ? customReminderDate
            : null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | ApiPayload
        | null;

      if (!response.ok) {
        throw new Error(
          getApiError(
            payload,
            "Unable to save your wish right now. Please try again.",
          ),
        );
      }

      if (
        typeof payload?.wishCode !== "string" ||
        typeof payload.wishContent !== "string" ||
        typeof payload.createdAt !== "string"
      ) {
        throw new Error("The wish was saved, but the response was incomplete.");
      }

      const emailVerification = parseEmailVerification(
        payload.emailVerification,
      );
      const submittedContactEmail =
        contactChoice === "no_email" ? null : contactEmail.trim();

      verificationPinRef.current =
        emailVerification.required && !emailVerification.verified ? pin : null;
      setSuccess({
        wishCode: payload.wishCode,
        wishContent: payload.wishContent,
        createdAt: payload.createdAt,
        contactEmail: submittedContactEmail,
        emailVerification,
      });
      setPin("");
      setConfirmPin("");
      setStep(5);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save your wish right now. Please try again.",
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (step === 1) {
      if (!wishContent.trim()) {
        setError("Write your wish before continuing.");
        return;
      }

      setStep(2);
      return;
    }

    if (step === 2) {
      if (!name.trim()) {
        setError("Enter a name for your wish.");
        return;
      }

      setName(name.trim());
      setStep(3);
      return;
    }

    if (step === 3) {
      if (pin.length < 4) {
        setError("PIN must be at least 4 digits.");
        return;
      }

      if (pin.length > 6) {
        setError("PIN must be no more than 6 digits.");
        return;
      }

      if (!PIN_PATTERN.test(pin)) {
        setError("PIN must contain numbers only.");
        return;
      }

      if (pin !== confirmPin) {
        setError("PIN and Confirm PIN do not match.");
        return;
      }

      setStep(4);
      return;
    }

    if (step === 4) {
      const contactError = validateContactStep();

      if (contactError) {
        setError(contactError);
        return;
      }

      await createWish();
    }
  }

  if (step === 5 && success) {
    return (
      <div className="journey-shell">
        <StepIndicator currentStep={step} totalSteps={TOTAL_STEPS} />
        <WishConfirmation
          contactEmail={success.contactEmail}
          contactType={contactChoice}
          createdAt={success.createdAt}
          emailVerification={success.emailVerification}
          isResendingVerification={isResendingVerification}
          name={name}
          onResendVerification={resendVerificationEmail}
          onReset={resetJourney}
          reminder={reminderText}
          verificationError={verificationError}
          verificationMessage={verificationMessage}
          wishCode={success.wishCode}
        />
      </div>
    );
  }

  return (
    <div className="journey-shell">
      <StepIndicator currentStep={step} totalSteps={TOTAL_STEPS} />

      <form className="journey-card" onSubmit={handleContinue} noValidate>
        {step === 1 ? (
          <section className="journey-step">
            <p className="eyebrow">Your wish</p>
            <h1>What is your wish?</h1>
            <p className="journey-lede">It can be big or small.</p>

            <div className="field wish-field">
              <label className="sr-only" htmlFor="wish-content">
                Your wish
              </label>
              <textarea
                autoComplete="off"
                className="textarea wish-textarea"
                id="wish-content"
                maxLength={WISH_LIMIT}
                name="wishContent"
                onChange={(event) => setWishContent(event.target.value)}
                placeholder="Write your wish here"
                rows={6}
                value={wishContent}
              />
              <p className="character-count">
                {wishContent.length} / {WISH_LIMIT}
              </p>
            </div>

            <p className="step-quote">
              A wish today.
              <br />
              A brighter tomorrow.
            </p>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="journey-step">
            <p className="eyebrow">Your name</p>
            <h1>What name would you like to use?</h1>
            <p className="journey-lede">
              We&apos;ll create a simple code for your wish.
            </p>

            <div className="field">
              <label className="label" htmlFor="wish-name">
                Name
              </label>
              <input
                autoComplete="name"
                className="input"
                id="wish-name"
                name="name"
                onChange={(event) => setName(event.target.value)}
                placeholder="Mary"
                type="text"
                value={name}
              />
            </div>

            <div className="code-preview">
              <div>
                <p className="code-preview-label">Your Wish Code</p>
                <p className="code-preview-value">Created when you save</p>
              </div>
              <WishBottleIllustration className="code-preview-art" />
              <p className="hint">
                We&apos;ll create a unique code for your wish when you save it.
              </p>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="journey-step">
            <p className="eyebrow">Your PIN</p>
            <h1>Create your PIN</h1>
            <p className="journey-lede">
              Use 4–6 digits. Remember this PIN. You will need it to find your wish later.
            </p>

            <div className="field">
              <label className="label" htmlFor="journey-pin">
                PIN
              </label>
              <input
                autoComplete="new-password"
                className="input"
                enterKeyHint="next"
                id="journey-pin"
                inputMode="numeric"
                maxLength={6}
                name="pin"
                onChange={(event) => updatePin(event.target.value, setPin)}
                pattern="[0-9]*"
                placeholder="4 to 6 digits"
                type="password"
                value={pin}
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="journey-confirm-pin">
                Confirm PIN
              </label>
              <input
                autoComplete="new-password"
                className="input"
                enterKeyHint="done"
                id="journey-confirm-pin"
                inputMode="numeric"
                maxLength={6}
                name="confirmPin"
                onChange={(event) =>
                  updatePin(event.target.value, setConfirmPin)
                }
                pattern="[0-9]*"
                placeholder="Enter your PIN again"
                type="password"
                value={confirmPin}
              />
              <p className="hint">
                Keep this PIN somewhere safe so you can find your wish later.
              </p>
            </div>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="journey-step">
            <p className="eyebrow">Bring your wish back</p>
            <h1>How shall we bring your wish back?</h1>

            <fieldset className="choice-fieldset">
              <legend className="sr-only">Email choice</legend>
              <label
                className={`choice-card ${contactChoice === "own_email" ? "is-selected" : ""}`}
              >
                <input
                  checked={contactChoice === "own_email"}
                  name="contactChoice"
                  onChange={() => setContactChoice("own_email")}
                  type="radio"
                  value="own_email"
                />
                <span>
                  <strong>I have my own email</strong>
                  <small>Use your email as the contact address.</small>
                </span>
              </label>

              <label
                className={`choice-card ${contactChoice === "parent_carer_email" ? "is-selected" : ""}`}
              >
                <input
                  checked={contactChoice === "parent_carer_email"}
                  name="contactChoice"
                  onChange={() => setContactChoice("parent_carer_email")}
                  type="radio"
                  value="parent_carer_email"
                />
                <span>
                  <strong>Use my parent&apos;s / carer&apos;s email</strong>
                  <small>
                    The contact email is not the Wish Owner.
                  </small>
                </span>
              </label>

              <label
                className={`choice-card ${contactChoice === "no_email" ? "is-selected" : ""}`}
              >
                <input
                  checked={contactChoice === "no_email"}
                  name="contactChoice"
                  onChange={() => setContactChoice("no_email")}
                  type="radio"
                  value="no_email"
                />
                <span>
                  <strong>I don&apos;t have an email yet</strong>
                  <small>You can still keep your Wish Code and PIN.</small>
                </span>
              </label>
            </fieldset>

            {contactChoice === "own_email" || contactChoice === "parent_carer_email" ? (
              <div className="field">
                <label className="label" htmlFor="contact-email">
                  {contactChoice === "parent_carer_email"
                    ? "Parent / Carer email"
                    : "Email address"}
                </label>
                <input
                  autoComplete="email"
                  className="input"
                  id="contact-email"
                  inputMode="email"
                  name="contactEmail"
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder="name@example.com"
                  type="email"
                  value={contactEmail}
                />
              </div>
            ) : null}

            <div className="reminder-section">
              <h2>When would you like to hear from us again?</h2>
              <div className="reminder-options">
                {([1, 3, 6, 12] as const).map((months) => (
                  <label
                    className={`reminder-chip ${reminderChoices.includes(months) ? "is-selected" : ""}`}
                    key={months}
                  >
                    <input
                      checked={reminderChoices.includes(months)}
                      name="reminders"
                      onChange={() => toggleReminder(months)}
                      type="checkbox"
                      value={months}
                    />
                    {REMINDER_LABELS[months]}
                  </label>
                ))}

                <label
                  className={`reminder-chip ${customReminderEnabled ? "is-selected" : ""}`}
                >
                  <input
                    checked={customReminderEnabled}
                    name="customReminder"
                    onChange={(event) =>
                      toggleCustomReminder(event.target.checked)
                    }
                    type="checkbox"
                  />
                  Custom Date
                </label>
              </div>

              {customReminderEnabled ? (
                <div className="field custom-date-field">
                  <label className="label" htmlFor="custom-reminder-date">
                    Remind me on
                  </label>
                  <input
                    className="input"
                    id="custom-reminder-date"
                    min={getTomorrowInTimeZone()}
                    name="customReminderDate"
                    onChange={(event) =>
                      setCustomReminderDate(event.target.value)
                    }
                    required
                    type="date"
                    value={customReminderDate}
                  />
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {error ? (
          <p className="status status-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="journey-actions">
          {step === 1 ? (
            <Link className="button button-secondary back-button" href="/">
              Back
            </Link>
          ) : (
            <button
              className="button button-secondary back-button"
              disabled={isSubmitting}
              onClick={goBack}
              type="button"
            >
              Back
            </button>
          )}
          <button
            className="button button-primary continue-button"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Saving your wish..." : "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}





