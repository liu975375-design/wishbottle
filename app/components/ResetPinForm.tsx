"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";

type ResetLinkState = "valid" | "expired" | "used" | "invalid";

type ResetPinFormProps = {
  linkState?: ResetLinkState;
};

const LINK_MESSAGES: Record<
  Exclude<ResetLinkState, "valid">,
  { heading: string; message: string }
> = {
  expired: {
    heading: "This reset link has expired.",
    message: "Please request a new one.",
  },
  used: {
    heading: "This reset link has already been used.",
    message:
      "Please request a new one if you still need to reset your PIN.",
  },
  invalid: {
    heading: "This reset link is not valid.",
    message: "Please request a new reset link.",
  },
};

export function ResetPinForm({ linkState = "valid" }: ResetPinFormProps) {
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  function updatePin(
    value: string,
    setter: (nextValue: string) => void,
  ): void {
    setter(value.replace(/\D/g, "").slice(0, 4));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

    if (!/^\d{4}$/.test(newPin)) {
      setError("PIN must be exactly 4 digits.");
      return;
    }

    if (newPin !== confirmPin) {
      setError("PINs do not match.");
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/pin-reset/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPin, confirmPin }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: unknown;
      } | null;

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to reset your PIN right now.",
        );
      }

      setSuccess(true);
      setNewPin("");
      setConfirmPin("");
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Unable to reset your PIN right now.",
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  if (linkState !== "valid") {
    const content = LINK_MESSAGES[linkState];

    return (
      <div className="journey-card">
        <p className="eyebrow">PIN reset</p>
        <h1>{content.heading}</h1>
        <p className="journey-lede">{content.message}</p>
        <Link className="button button-primary" href="/find">
          Find My Wish
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="journey-card">
        <p className="eyebrow">PIN updated</p>
        <h1>Your PIN has been reset.</h1>
        <p className="journey-lede">
          You can now use your new PIN to find your wish.
        </p>
        <Link className="button button-primary" href="/find">
          Find My Wish
        </Link>
      </div>
    );
  }

  return (
    <div className="journey-card">
      <p className="eyebrow">PIN reset</p>
      <h1>Reset your PIN</h1>
      <p className="journey-lede">Choose a new 4-digit PIN.</p>

      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="label" htmlFor="new-pin">
            New PIN
          </label>
          <input
            autoComplete="new-password"
            className="input"
            id="new-pin"
            inputMode="numeric"
            maxLength={4}
            onChange={(event) => updatePin(event.target.value, setNewPin)}
            pattern="[0-9]{4}"
            placeholder="Use 4 digits"
            type="password"
            value={newPin}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="confirm-new-pin">
            Confirm PIN
          </label>
          <input
            autoComplete="new-password"
            className="input"
            id="confirm-new-pin"
            inputMode="numeric"
            maxLength={4}
            onChange={(event) => updatePin(event.target.value, setConfirmPin)}
            pattern="[0-9]{4}"
            placeholder="Enter your new PIN again"
            type="password"
            value={confirmPin}
          />
        </div>

        {error ? (
          <p className="status status-error" role="alert">
            {error}
          </p>
        ) : null}

        <button
          className="button button-primary"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Resetting..." : "Reset PIN"}
        </button>
      </form>
    </div>
  );
}
