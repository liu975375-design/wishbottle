"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import {
  getDateInTimeZone,
  getTomorrowInTimeZone,
  MAX_WISH_CONTENT_LENGTH,
} from "@/lib/wish-journey";

import { PinInput } from "./PinInput";
import { WishConfirmation } from "./WishConfirmation";
import { WishSavedAnimation } from "./WishSavedAnimation";

type Step = 1 | 2 | 3 | 4 | 5;
type ContactChoice = "" | "own_email" | "parent_carer_email" | "no_email";
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

type CreateSuccess = {
  wishSaved: boolean;
  reminderScheduled: boolean;
  reminderDates: string[];
  wishCode: string;
  wishContent: string;
  createdAt: string;
  pinSetupToken: string;
  contactEmail: string | null;
  emailVerification: EmailVerificationSummary;
};

type ApiPayload = {
  error?: unknown;
  wishCode?: unknown;
  wishContent?: unknown;
  createdAt?: unknown;
  pinSetupToken?: unknown;
  emailVerification?: unknown;
  wishSaved?: unknown;
  reminderScheduled?: unknown;
  reminderCount?: unknown;
  reminderDates?: unknown;
};

const EMAIL_VERIFICATION_STATUSES: EmailVerificationStatus[] = [
  "not_required",
  "already_verified",
  "sent",
  "cooldown",
  "failed",
];

function parseEmailVerification(value: unknown): EmailVerificationSummary {
  if (typeof value !== "object" || value === null) {
    return {
      required: false,
      status: "failed",
      verified: false,
      sent: false,
      cooldown: false,
      retryable: true,
    };
  }

  const record = value as Record<string, unknown>;
  const status =
    typeof record.status === "string" &&
    EMAIL_VERIFICATION_STATUSES.includes(
      record.status as EmailVerificationStatus,
    )
      ? (record.status as EmailVerificationStatus)
      : "failed";

  return {
    required: record.required === true,
    status,
    verified: record.verified === true,
    sent: record.sent === true,
    cooldown: record.cooldown === true,
    retryable: record.retryable === true,
  };
}

const PIN_PATTERN = /^\d{4}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REMINDER_LABELS: Record<number, string> = {
  "1": "1 month",
  "3": "3 months",
  "6": "6 months",
  "12": "12 months",
};

function parseReminderDates(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const dates = value.filter(
    (item): item is string =>
      typeof item === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item),
  );

  return dates.length === value.length ? dates : null;
}

function formatReminderDates(dates: string[]): string {
  return dates
    .map((date) =>
      new Date(`${date}T12:00:00.000Z`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        timeZone: "UTC",
        year: "numeric",
      }),
    )
    .join(", ");
}

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
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [pinCreated, setPinCreated] = useState(false);
  const [success, setSuccess] = useState<CreateSuccess | null>(null);
  const [isResendingVerification, setIsResendingVerification] =
    useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );
  const submittingRef = useRef(false);
  const settingPinRef = useRef(false);
  const savingRequestFinishedRef = useRef(false);
  const animationFinishedRef = useRef(false);
  const resendVerificationRef = useRef(false);
  const verificationPinRef = useRef<string | null>(null);
  const idempotencyKeyRef = useRef(createIdempotencyKey());

  function updatePin(
    value: string,
    setter: (nextValue: string) => void,
  ): void {
    setter(value.replace(/\D/g, "").slice(0, 4));
  }

  useEffect(() => {
    function handleRequestedBack(event: Event) {
      if (step === 1) {
        return;
      }

      event.preventDefault();

      if (step >= 4) {
        return;
      }

      setError(null);
      setStep((currentStep) => ((currentStep - 1) as Step));
    }

    window.addEventListener("wishbottle:request-back", handleRequestedBack);
    return () => {
      window.removeEventListener("wishbottle:request-back", handleRequestedBack);
    };
  }, [step]);

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
    setPinCreated(false);
    setIsSettingPin(false);
    settingPinRef.current = false;
    savingRequestFinishedRef.current = false;
    animationFinishedRef.current = false;
    idempotencyKeyRef.current = createIdempotencyKey();
    verificationPinRef.current = null;
    setVerificationError(null);
    setError(null);
    setSuccess(null);
  }

  function toggleReminder(months: number): void {
    setReminderChoices((current) =>
      current.includes(months) ? [] : [months],
    );
    setCustomReminderEnabled(false);
    setCustomReminderDate("");
  }

  function toggleCustomReminder(enabled: boolean): void {
    setCustomReminderEnabled(enabled);

    if (enabled) {
      setReminderChoices([]);
    } else {
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
        emailVerification?: unknown;
      } | null;

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to resend the verification email.",
        );
      }

      const emailVerification = parseEmailVerification(
        payload?.emailVerification,
      );
      setSuccess((current) =>
        current ? { ...current, emailVerification } : current,
      );

      if (emailVerification.status === "already_verified") {
        return;
      } else if (emailVerification.status === "cooldown") {
        return;
      } else if (emailVerification.status === "sent") {
        return;
      } else {
        throw new Error("Unable to resend the verification email.");
      }
    } catch (resendError) {
      setSuccess((current) =>
        current
          ? {
              ...current,
              emailVerification: {
                required: true,
                status: "failed",
                verified: false,
                sent: false,
                cooldown: false,
                retryable: true,
              },
            }
          : current,
      );
      setVerificationError(
        resendError instanceof Error
          ? resendError.message
          : "Unable to resend the verification email.",
      );
    } finally {
      resendVerificationRef.current = false;
      setIsResendingVerification(false);
    }
  }  function advanceAfterSave() {
    if (savingRequestFinishedRef.current && animationFinishedRef.current) {
      setStep(5);
    }
  }

  async function createWish() {
    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    savingRequestFinishedRef.current = false;
    animationFinishedRef.current = false;

    try {
      const response = await fetch("/api/wishes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wishContent,
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
        payload?.wishSaved !== true ||
        payload.reminderScheduled !== true ||
        typeof payload?.wishCode !== "string" ||
        typeof payload.wishContent !== "string" ||
        typeof payload.createdAt !== "string" ||
        typeof payload.pinSetupToken !== "string"
      ) {
        throw new Error("The wish was saved, but the response was incomplete.");
      }

      const reminderDates = parseReminderDates(payload.reminderDates);

      if (
        !reminderDates ||
        typeof payload.reminderCount !== "number" ||
        payload.reminderCount !== reminderDates.length
      ) {
        throw new Error("The wish was saved, but the response was incomplete.");
      }

      const emailVerification = parseEmailVerification(
        payload.emailVerification,
      );
      const submittedContactEmail =
        contactChoice === "no_email" ? null : contactEmail.trim();

      setSuccess({
        wishSaved: true,
        reminderScheduled: true,
        reminderDates,
        wishCode: payload.wishCode,
        wishContent: payload.wishContent,
        createdAt: payload.createdAt,
        pinSetupToken: payload.pinSetupToken,
        contactEmail: submittedContactEmail,
        emailVerification,
      });
      savingRequestFinishedRef.current = true;
      advanceAfterSave();
    } catch (submitError) {
      savingRequestFinishedRef.current = false;
      animationFinishedRef.current = false;
      setStep(3);
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

  function handleAnimationComplete() {
    animationFinishedRef.current = true;
    advanceAfterSave();
  }

  async function savePin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (settingPinRef.current || !success) {
      return;
    }

    if (!PIN_PATTERN.test(pin)) {
      setError("PIN must be exactly 4 digits.");
      return;
    }

    if (pin !== confirmPin) {
      setError("PIN and Confirm PIN do not match.");
      return;
    }

    settingPinRef.current = true;
    setIsSettingPin(true);
    setError(null);

    try {
      const response = await fetch("/api/wishes/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wishCode: success.wishCode,
          setupToken: success.pinSetupToken,
          pin,
          confirmPin,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: unknown;
      } | null;

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to set your PIN right now. Please try again.",
        );
      }

      verificationPinRef.current = pin;
      setPin("");
      setConfirmPin("");
      setPinCreated(true);
    } catch (pinError) {
      setError(
        pinError instanceof Error
          ? pinError.message
          : "Unable to set your PIN right now. Please try again.",
      );
    } finally {
      settingPinRef.current = false;
      setIsSettingPin(false);
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
      const contactError = validateContactStep();

      if (contactError) {
        setError(contactError);
        return;
      }

      setStep(4);
      await createWish();
    }
  }

  if (step === 4) {
    return (
      <div className="journey-shell create-shell saving-shell">
        <WishSavedAnimation
          confirmed={Boolean(success)}
          onComplete={handleAnimationComplete}
          wishCode={success?.wishCode ?? ""}
          wishContent={wishContent}
        />
      </div>
    );
  }

  if (step === 5 && success && !pinCreated) {
    return (
      <div className="journey-shell create-shell pin-setup-shell">
        <form className="journey-card pin-setup-form" onSubmit={savePin} noValidate>
          <section className="journey-step">
            <h1>Your Wish Code</h1>
            <p className="journey-lede">
              Your wish has been saved.
              <br />
              Create a 4-digit PIN to return to it later.
            </p>

            <div className="wish-code-card">
              <span>Wish Code</span>
              <output>{success.wishCode}</output>
            </div>

            <div className="field pin-create-field">
              <label className="label" htmlFor="journey-pin">
                Create a PIN
              </label>
              <p className="pin-field-help">Choose a 4-digit PIN to keep your wish safe.</p>
              <PinInput
                enterKeyHint="next"
                id="journey-pin"
                label="Create 4-digit PIN"
                name="pin"
                onChange={(value) => updatePin(value, setPin)}
                value={pin}
              />
            </div>

            <div className="field pin-create-field">
              <label className="label" htmlFor="journey-confirm-pin">
                Confirm PIN
              </label>
              <p className="pin-field-help">Enter the same 4-digit PIN again.</p>
              <PinInput
                describedBy="pin-help"
                enterKeyHint="done"
                id="journey-confirm-pin"
                label="Confirm 4-digit PIN"
                name="confirmPin"
                onChange={(value) => updatePin(value, setConfirmPin)}
                value={confirmPin}
              />
              <p className="hint" id="pin-help">
                Choose 4 numbers and keep them somewhere safe.
              </p>
            </div>
          </section>

          {error ? (
            <p className="status status-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="journey-actions">
            <button
              className="button button-primary continue-button"
              disabled={isSettingPin}
              type="submit"
            >
              {isSettingPin ? "Saving your PIN..." : "Save PIN"}
              {!isSettingPin ? (
                <span aria-hidden="true" className="button-chevron">›</span>
              ) : null}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (step === 5 && success && pinCreated) {
    return (
      <div className="journey-shell confirmation-shell">
        <WishConfirmation
          contactEmail={success.contactEmail}
          contactType={contactChoice}
          createdAt={success.createdAt}
          emailVerification={success.emailVerification}
          isResendingVerification={isResendingVerification}
          name={name}
          onResendVerification={resendVerificationEmail}
          onReset={resetJourney}
          reminder={formatReminderDates(success.reminderDates)}
          reminderScheduled={success.reminderScheduled}
          verificationError={verificationError}
          wishSaved={success.wishSaved}
          wishCode={success.wishCode}
        />
      </div>
    );
  }

  return (
    <div className="journey-shell create-shell">
      <form className="journey-card" onSubmit={handleContinue} noValidate>
        {step === 1 ? (
          <section className="journey-step">
            <h1>Make a New Wish</h1>
            <p className="journey-lede">
              Write your private wish below.
              <br />
              Keep it kind, hopeful, and uniquely yours.
            </p>

            <div className="field wish-field">
              <label className="sr-only" htmlFor="wish-content">
                Your wish
              </label>
              <textarea
                autoComplete="off"
                className="textarea wish-textarea"
                id="wish-content"
                maxLength={MAX_WISH_CONTENT_LENGTH}
                name="wishContent"
                onChange={(event) => setWishContent(event.target.value)}
                placeholder="Write your wish here..."
                rows={7}
                value={wishContent}
              />
              <p className="character-count">
                {wishContent.length}/{MAX_WISH_CONTENT_LENGTH}
              </p>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="journey-step">
            <h1>Name Your Wish</h1>
            <p className="journey-lede">
              Give this wish a name that feels right to you.
              <br />
              It will help create your private Wish Code.
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
                placeholder="A wish for..."
                type="text"
                value={name}
              />
            </div>

            <div className="quiet-note">
              <span aria-hidden="true">♡</span>
              <p>Your name only helps us create a Wish Code. It is not shown publicly.</p>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="journey-step reminder-step">
            <h1>When would you like to be reminded?</h1>
            <p className="journey-lede">
              We&apos;ll gently remind you to return
              <br />
              to your wish on your chosen date.
            </p>

            <div className="contact-choice-block">
              <p className="field-section-label">How should we bring it back?</p>
              <div className="contact-choice-list">
                <label className={contactChoice === "own_email" ? "is-selected" : ""}>
                  <input
                    checked={contactChoice === "own_email"}
                    name="contactChoice"
                    onChange={() => setContactChoice("own_email")}
                    type="radio"
                    value="own_email"
                  />
                  <span><strong>My own email</strong><small>Use your email for reminders and PIN recovery.</small></span>
                </label>
                <label className={contactChoice === "parent_carer_email" ? "is-selected" : ""}>
                  <input
                    checked={contactChoice === "parent_carer_email"}
                    name="contactChoice"
                    onChange={() => setContactChoice("parent_carer_email")}
                    type="radio"
                    value="parent_carer_email"
                  />
                  <span><strong>A parent or carer&apos;s email</strong><small>They will receive reminders, not own the wish.</small></span>
                </label>
                <label className={contactChoice === "no_email" ? "is-selected" : ""}>
                  <input
                    checked={contactChoice === "no_email"}
                    name="contactChoice"
                    onChange={() => setContactChoice("no_email")}
                    type="radio"
                    value="no_email"
                  />
                  <span><strong>No email for now</strong><small>Keep your Wish Code and PIN instead.</small></span>
                </label>
              </div>

              {contactChoice === "own_email" || contactChoice === "parent_carer_email" ? (
                <div className="field contact-email-field">
                  <label className="label" htmlFor="contact-email">
                    {contactChoice === "parent_carer_email" ? "Parent / Carer email" : "Email address"}
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
            </div>

            <div className="reminder-section">
              <p className="field-section-label">Choose when to return</p>
              <div className="reminder-options reminder-list">
                {([1, 3, 6, 12] as const).map((months) => (
                  <label
                    className={`reminder-chip ${reminderChoices.includes(months) ? "is-selected" : ""}`}
                    key={months}
                  >
                    <input
                      checked={reminderChoices.includes(months)}
                      name="reminders"
                      onChange={() => toggleReminder(months)}
                      type="radio"
                      value={months}
                    />
                    <span aria-hidden="true" className="calendar-mark" />
                    <strong>{REMINDER_LABELS[months]}</strong>
                  </label>
                ))}

                <label className={`reminder-chip ${customReminderEnabled ? "is-selected" : ""}`}>
                  <input
                    checked={customReminderEnabled}
                    name="customReminder"
                    onChange={(event) => toggleCustomReminder(event.target.checked)}
                    type="radio"
                  />
                  <span aria-hidden="true" className="calendar-mark" />
                  <strong>Custom date</strong>
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
                    onChange={(event) => setCustomReminderDate(event.target.value)}
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
          <button
            className="button button-primary continue-button"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Saving your wish..." : step === 3 ? "Save Wish" : "Continue"}
            {!isSubmitting ? <span aria-hidden="true" className="button-chevron">›</span> : null}
          </button>
        </div>
      </form>
    </div>
  );
}

