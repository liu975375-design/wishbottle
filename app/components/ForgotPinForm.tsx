"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";

import { isValidEmail } from "@/lib/validation";

type ResetRequestStatus =
  | "idle"
  | "sending"
  | "sent"
  | "email_verification_required"
  | "invalid_email"
  | "email_mismatch"
  | "send_failed"
  | "invalid_wish_code"
  | "rate_limited";

type VerificationRequestStatus =
  | "idle"
  | "sending"
  | "sent"
  | "already_verified"
  | "rate_limited"
  | "failed";

type ForgotPinFormProps = {
  initialWishCode?: string;
};

const BACK_TO_FIND_LABEL = "Back to Find My Wish";

export function ForgotPinForm({
  initialWishCode = "",
}: ForgotPinFormProps) {
  const [email, setEmail] = useState("");
  const [wishCode, setWishCode] = useState(initialWishCode.toUpperCase());
  const [resetStatus, setResetStatus] =
    useState<ResetRequestStatus>("idle");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetMaskedEmail, setResetMaskedEmail] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationRequestStatus>("idle");
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );
  const [verificationMaskedEmail, setVerificationMaskedEmail] = useState<
    string | null
  >(null);
  const resetRequestRef = useRef(false);
  const verificationRequestRef = useRef(false);
  const backHref = wishCode.trim()
    ? `/find?wishCode=${encodeURIComponent(wishCode.trim())}`
    : "/find";

  function resetState() {
    setResetStatus("idle");
    setResetError(null);
    setResetMaskedEmail(null);
    setVerificationStatus("idle");
    setVerificationError(null);
    setVerificationMaskedEmail(null);
  }

  function handleWishCodeChange(value: string) {
    setWishCode(value.toUpperCase());
    resetState();
  }

  async function requestPinReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (resetRequestRef.current) {
      return;
    }

    if (!wishCode.trim()) {
      setResetStatus("invalid_wish_code");
      setResetError("Please enter your Wish Code first.");
      return;
    }

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setResetStatus("invalid_email");
      setResetError("Please enter your email first.");
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setResetStatus("invalid_email");
      setResetError("Please enter a valid email address.");
      return;
    }

    resetRequestRef.current = true;
    setResetStatus("sending");
    setResetError(null);
    setResetMaskedEmail(null);
    setVerificationStatus("idle");
    setVerificationError(null);

    try {
      const response = await fetch("/api/pin-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, wishCode }),
      });
      const payload = (await response.json().catch(() => null)) as {
        status?: unknown;
        error?: unknown;
        message?: unknown;
        maskedEmail?: unknown;
      } | null;
      const maskedEmail =
        typeof payload?.maskedEmail === "string" ? payload.maskedEmail : null;

      if (payload?.status === "sent") {
        setResetStatus("sent");
        setResetMaskedEmail(maskedEmail);
        return;
      }

      if (payload?.status === "rate_limited") {
        setResetStatus("rate_limited");
        setResetMaskedEmail(maskedEmail);
        setResetError(
          typeof payload.message === "string"
            ? payload.message
            : "A reset email was sent recently. Please check your inbox or wait before trying again.",
        );
        return;
      }

      if (payload?.status === "email_verification_required") {
        setResetStatus("email_verification_required");
        setResetError("This wish's email hasn't been verified yet.");
        return;
      }

      if (payload?.status === "invalid_email") {
        setResetStatus("invalid_email");
        setResetError(
          typeof payload.error === "string"
            ? payload.error
            : "Please enter a valid email address.",
        );
        return;
      }

      if (payload?.status === "email_mismatch") {
        setResetStatus("email_mismatch");
        setResetError(
          "The email does not match this Wish. Please check your details and try again.",
        );
        return;
      }

      if (payload?.status === "invalid_wish_code") {
        setResetStatus("invalid_wish_code");
        setResetError(
          typeof payload.error === "string"
            ? payload.error
            : "Wish not found. Please check your Wish Code.",
        );
        return;
      }

      setResetStatus("send_failed");
      setResetError(
        "Reset email could not be sent. Please try again.",
      );
    } catch {
      setResetStatus("send_failed");
      setResetError("Reset email could not be sent. Please try again.");
    } finally {
      resetRequestRef.current = false;
    }
  }

  async function requestVerificationEmail() {
    if (verificationRequestRef.current) {
      return;
    }

    if (!wishCode.trim()) {
      setResetStatus("invalid_wish_code");
      setResetError("Please enter your Wish Code first.");
      return;
    }

    const normalizedEmail = email.trim();

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      setResetStatus("invalid_email");
      setResetError(
        normalizedEmail
          ? "Please enter a valid email address."
          : "Please enter your email first.",
      );
      return;
    }

    verificationRequestRef.current = true;
    setVerificationStatus("sending");
    setVerificationError(null);

    try {
      const response = await fetch("/api/pin-reset/verification-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, wishCode }),
      });
      const payload = (await response.json().catch(() => null)) as {
        status?: unknown;
        error?: unknown;
        message?: unknown;
        maskedEmail?: unknown;
      } | null;
      const maskedEmail =
        typeof payload?.maskedEmail === "string" ? payload.maskedEmail : null;

      if (payload?.status === "sent") {
        setVerificationStatus("sent");
        setVerificationMaskedEmail(maskedEmail);
        setResetStatus("idle");
        setResetError(null);
        return;
      }

      if (payload?.status === "already_verified") {
        setVerificationStatus("already_verified");
        setVerificationMaskedEmail(maskedEmail);
        setResetStatus("idle");
        setResetError(null);
        return;
      }

      if (payload?.status === "rate_limited") {
        setVerificationStatus("rate_limited");
        setVerificationMaskedEmail(maskedEmail);
        return;
      }

      if (
        payload?.status === "invalid_email" ||
        payload?.status === "email_mismatch"
      ) {
        setVerificationStatus("failed");
        setVerificationError(
          payload.status === "email_mismatch"
            ? "The email does not match this Wish. Please check your details and try again."
            : "Please enter a valid email address.",
        );
        return;
      }

      setVerificationStatus("failed");
      setVerificationError(
        payload?.status === "send_failed"
          ? "Verification email could not be sent. Please try again."
          : "Verification email could not be sent. Please try again.",
      );
    } catch {
      setVerificationStatus("failed");
      setVerificationError(
        "Verification email could not be sent. Please try again.",
      );
    } finally {
      verificationRequestRef.current = false;
    }
  }

  const isRequestingReset = resetStatus === "sending";
  const isRequestingVerification = verificationStatus === "sending";

  return (
    <div className="forgot-pin-content">
      <form className="forgot-pin-form" onSubmit={requestPinReset} noValidate>
        <div className="field">
          <label className="label" htmlFor="forgot-email">
            Email
          </label>
          <input
            autoComplete="email"
            className="input"
            enterKeyHint="next"
            id="forgot-email"
            inputMode="email"
            name="email"
            onChange={(event) => {
              setEmail(event.target.value);
              resetState();
            }}
            placeholder="Enter your email"
            required
            type="email"
            value={email}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="forgot-wish-code">
            Wish Code
          </label>
          <input
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            className="input input-code"
            enterKeyHint="send"
            id="forgot-wish-code"
            maxLength={128}
            name="wishCode"
            onChange={(event) => handleWishCodeChange(event.target.value)}
            placeholder="Enter your Wish Code"
            required
            spellCheck={false}
            type="text"
            value={wishCode}
          />
        </div>

        {resetStatus === "sent" ? (
          <div className="status status-success" role="status">
            <strong>Reset link sent to {resetMaskedEmail}.</strong>
            <span>Please check your inbox and spam folder.</span>
          </div>
        ) : null}

        {resetStatus === "rate_limited" ? (
          <div className="status" role="status">
            <strong>
              Reset email already sent to {resetMaskedEmail ?? "your email"}.
            </strong>
            <span>{resetError}</span>
          </div>
        ) : null}

        {resetStatus === "invalid_wish_code" && resetError ? (
          <p className="status status-error" role="alert">
            {resetError}
          </p>
        ) : null}

        {resetStatus === "invalid_email" && resetError ? (
          <p className="status status-error" role="alert">
            {resetError}
          </p>
        ) : null}

        {resetStatus === "email_mismatch" && resetError ? (
          <p className="status status-error" role="alert">
            {resetError}
          </p>
        ) : null}

        {resetStatus === "email_verification_required" ? (
          <div className="forgot-pin-verification">
            <p className="status status-error" role="alert">
              This wish&apos;s email hasn&apos;t been verified yet.
            </p>
            <button
              className="button button-secondary"
              disabled={isRequestingVerification}
              onClick={requestVerificationEmail}
              type="button"
            >
              {isRequestingVerification
                ? "Sending verification email..."
                : "Send verification email"}
            </button>
          </div>
        ) : null}

        {verificationStatus === "sent" ? (
          <p className="status status-success" role="status">
            Verification email sent to {verificationMaskedEmail}. Verify it,
            then request the reset link again.
          </p>
        ) : null}

        {verificationStatus === "already_verified" ? (
          <p className="status status-success" role="status">
            {verificationMaskedEmail
              ? `${verificationMaskedEmail} is already verified.`
              : "This email is already verified."}{" "}
            You can request the reset link again.
          </p>
        ) : null}

        {verificationStatus === "rate_limited" ? (
          <p className="status" role="status">
            A verification email was sent recently
            {verificationMaskedEmail
              ? ` to ${verificationMaskedEmail}`
              : ""}
            . Please check your inbox or wait before trying again.
          </p>
        ) : null}

        {verificationStatus === "failed" && verificationError ? (
          <p className="status status-error" role="alert">
            {verificationError}
          </p>
        ) : null}

        {resetStatus === "send_failed" && resetError ? (
          <p className="status status-error" role="alert">
            {resetError}
          </p>
        ) : null}

        <button
          className="button button-primary forgot-pin-submit"
          disabled={isRequestingReset}
          type="submit"
        >
          {isRequestingReset ? "Sending..." : "Send Reset Link"}
        </button>

        <p className="forgot-pin-help">
          Don&apos;t remember your Wish Code? Check your original Wish
          confirmation email.
        </p>
      </form>

      <Link className="button-link forgot-pin-back" href={backHref}>
        <span aria-hidden="true">←</span> {BACK_TO_FIND_LABEL}
      </Link>
    </div>
  );
}
