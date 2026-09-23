"use client";

import { FormEvent, useRef, useState } from "react";

import { WishBottleIllustration } from "./WishBottleIllustration";

type FoundWish = {
  wishCode: string;
  wishContent: string;
  createdAt: string;
};

type ApiPayload = {
  error?: unknown;
  wish?: {
    wishCode?: unknown;
    wishContent?: unknown;
    createdAt?: unknown;
  };
};

function getApiError(payload: ApiPayload | null, fallback: string): string {
  return typeof payload?.error === "string" ? payload.error : fallback;
}

export function FindWishForm() {
  const [wishCode, setWishCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [foundWish, setFoundWish] = useState<FoundWish | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  function updatePin(value: string): void {
    setPin(value.replace(/\D/g, "").slice(0, 6));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    setFoundWish(null);

    try {
      const response = await fetch("/api/wishes/find", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wishCode,
          pin,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | ApiPayload
        | null;

      if (!response.ok) {
        throw new Error(
          getApiError(payload, "Wish Code or PIN is incorrect."),
        );
      }

      if (
        typeof payload?.wish?.wishCode !== "string" ||
        typeof payload.wish.wishContent !== "string" ||
        typeof payload.wish.createdAt !== "string"
      ) {
        throw new Error("Unable to find your wish right now. Please try again.");
      }

      setFoundWish({
        wishCode: payload.wish.wishCode,
        wishContent: payload.wish.wishContent,
        createdAt: payload.wish.createdAt,
      });
      setPin("");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Wish Code or PIN is incorrect.",
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="wish-card find-card">
      <WishBottleIllustration className="find-card-art" />

      <form className="form" onSubmit={handleSubmit} noValidate>
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
            placeholder="Example: MAPLE-4827"
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
          <input
            autoComplete="current-password"
            className="input"
            enterKeyHint="done"
            id="find-pin"
            inputMode="numeric"
            maxLength={6}
            name="pin"
            onChange={(event) => updatePin(event.target.value)}
            pattern="[0-9]*"
            placeholder="4 to 6 digits"
            required
            type="password"
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
      </form>

      {foundWish ? (
        <section aria-live="polite" className="find-result">
          <p className="eyebrow">Wish found</p>
          <h2>Here is your wish</h2>
          <p className="wish-content">{foundWish.wishContent}</p>
          <dl className="find-result-details">
            <div>
              <dt>Wish Code</dt>
              <dd>{foundWish.wishCode}</dd>
            </div>
            <div>
              <dt>Saved</dt>
              <dd>{new Date(foundWish.createdAt).toLocaleDateString()}</dd>
            </div>
          </dl>
          <p className="hint">Keep your Wish Code and PIN somewhere safe.</p>
        </section>
      ) : null}
    </div>
  );
}

