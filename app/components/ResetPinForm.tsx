"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";

type ResetPinFormProps = {
  invalidLink?: boolean;
};

export function ResetPinForm({ invalidLink = false }: ResetPinFormProps) {
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
    setter(value.replace(/\D/g, "").slice(0, 6));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submittingRef.current) {
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

  if (invalidLink) {
    return (
      <div className="journey-card">
        <p className="eyebrow">PIN reset</p>
        <h1>This reset link is not valid.</h1>
        <p className="journey-lede">
          The link may have expired or already been used.
        </p>
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
        <h1>Your new PIN is ready.</h1>
        <p className="journey-lede">
          You can now find your wish with your Wish Code and new PIN.
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
      <h1>Choose a new PIN</h1>
      <p className="journey-lede">
        Use 4–6 digits and confirm it below.
      </p>

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
            maxLength={6}
            onChange={(event) => updatePin(event.target.value, setNewPin)}
            pattern="[0-9]*"
            placeholder="4 to 6 digits"
            type="password"
            value={newPin}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="confirm-new-pin">
            Confirm new PIN
          </label>
          <input
            autoComplete="new-password"
            className="input"
            id="confirm-new-pin"
            inputMode="numeric"
            maxLength={6}
            onChange={(event) => updatePin(event.target.value, setConfirmPin)}
            pattern="[0-9]*"
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
          {isSubmitting ? "Saving..." : "Save New PIN"}
        </button>
      </form>
    </div>
  );
}
