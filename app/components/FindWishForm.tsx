"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";

import { PinInput } from "./PinInput";

type ApiPayload = {
  error?: unknown;
  wish?: {
    wishCode?: unknown;
    wishContent?: unknown;
    createdAt?: unknown;
  };
};

type FindWishFormProps = {
  initialWishCode?: string;
};

function getApiError(payload: ApiPayload | null, fallback: string): string {
  return typeof payload?.error === "string" ? payload.error : fallback;
}

const FOUND_WISH_STORAGE_KEY = "wishbottle:found-wish";

export function FindWishForm({ initialWishCode = "" }: FindWishFormProps) {
  const router = useRouter();
  const [wishCode, setWishCode] = useState(initialWishCode.toUpperCase());
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const forgotPinHref = wishCode.trim()
    ? `/forgot-pin?wishCode=${encodeURIComponent(wishCode.trim())}`
    : "/forgot-pin";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/wishes/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wishCode, pin }),
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload | null;

      if (!response.ok) {
        throw new Error(
          getApiError(
            payload,
            "Unable to find your wish right now. Please try again.",
          ),
        );
      }

      if (
        typeof payload?.wish?.wishCode !== "string" ||
        typeof payload.wish.wishContent !== "string" ||
        typeof payload.wish.createdAt !== "string"
      ) {
        throw new Error("Unable to find your wish right now. Please try again.");
      }

      window.sessionStorage.setItem(
        FOUND_WISH_STORAGE_KEY,
        JSON.stringify({
          wishCode: payload.wish.wishCode,
          wishContent: payload.wish.wishContent,
          createdAt: payload.wish.createdAt,
        }),
      );
      setPin("");
      router.push("/wish-found");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to find your wish right now. Please try again.",
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <form className="find-form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label className="label" htmlFor="wish-code">
          Wish Code
        </label>
        <input
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          className="input input-code"
          enterKeyHint="next"
          id="wish-code"
          maxLength={128}
          name="wishCode"
          onChange={(event) => setWishCode(event.target.value.toUpperCase())}
          placeholder="Enter your Wish Code"
          required
          spellCheck={false}
          type="text"
          value={wishCode}
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="find-pin">
          PIN
        </label>
        <PinInput
          autoComplete="current-password"
          enterKeyHint="done"
          id="find-pin"
          label="PIN"
          name="pin"
          onChange={setPin}
          value={pin}
        />
      </div>

      {error ? (
        <p className="status status-error" role="alert">
          {error}
        </p>
      ) : null}

      <button
        className="button button-primary find-button"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Finding your wish..." : "Find My Wish"}
      </button>

      <Link className="button-link need-help-button" href={forgotPinHref}>
        Forgot your PIN?
      </Link>
    </form>
  );
}
