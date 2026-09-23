"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

type ReturnedWish = {
  id: string;
  wish_code: string;
  wish_content: string;

  created_at: string;
  updated_at: string;
};

type ResponseType =
  | "nothing_changed"
  | "something_changed"
  | "future_note"
  | "remind_later";

const RESPONSE_OPTIONS: Array<{
  value: ResponseType;
  title: string;
  description: string;
}> = [
  {
    value: "nothing_changed",
    title: "Nothing has changed yet",
    description: "Keep the wish as it is.",
  },
  {
    value: "something_changed",
    title: "Something has changed",
    description: "Add a short note about what is different.",
  },
  {
    value: "future_note",
    title: "Add a note to my future self",
    description: "Leave a thought for the next time you return.",
  },
  {
    value: "remind_later",
    title: "Remind me again later",
    description: "Choose another reminder interval.",
  },
];

export function WishReturnView() {
  const [wish, setWish] = useState<ReturnedWish | null>(null);
  const [wishContent, setWishContent] = useState("");
  const [responseType, setResponseType] = useState<ResponseType | null>(null);
  const [note, setNote] = useState("");
  const [remindMonths, setRemindMonths] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [managementMessage, setManagementMessage] = useState<string | null>(
    null,
  );
  const [isManaging, setIsManaging] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const savingRef = useRef(false);
  const managingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadWish() {
      try {
        const response = await fetch("/api/wish", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | { wish?: ReturnedWish; error?: string }
          | null;

        if (!response.ok || !payload?.wish) {
          throw new Error(payload?.error ?? "This return link is not valid.");
        }

        if (!cancelled) {
          setWish(payload.wish);
          setWishContent(payload.wish.wish_content);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load your wish.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadWish();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (savingRef.current || !responseType) {
      return;
    }

    if (responseType === "future_note" && !note.trim()) {
      setError("Add a note for your future self.");
      return;
    }

    if (responseType === "remind_later" && !remindMonths) {
      setError("Choose 1, 3, 6, or 12 months.");
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch("/api/wish/reflection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responseType,
          note,
          wishContent,
          remindMonths,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: unknown;
      } | null;

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to save your reflection right now.",
        );
      }

      setWish((current) =>
        current ? { ...current, wish_content: wishContent.trim() } : current,
      );
      setSaved(true);
      setNote("");
      setResponseType(null);
      setRemindMonths(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save your reflection right now.",
      );
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }


  async function stopFutureReminders() {
    if (managingRef.current) {
      return;
    }

    if (
      !window.confirm("Are you sure you want to stop future reminders?")
    ) {
      return;
    }

    managingRef.current = true;
    setIsManaging(true);
    setError(null);
    setManagementMessage(null);

    try {
      const response = await fetch("/api/wish/reminders/stop", {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: unknown;
      } | null;

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to stop reminders right now.",
        );
      }

      setManagementMessage("Future reminders have been stopped.");
    } catch (managementError) {
      setError(
        managementError instanceof Error
          ? managementError.message
          : "Unable to stop reminders right now.",
      );
    } finally {
      managingRef.current = false;
      setIsManaging(false);
    }
  }

  async function deleteWish() {
    if (managingRef.current) {
      return;
    }

    if (
      !window.confirm(
        "This action cannot be undone.\n\nAre you sure you want to delete this wish?",
      )
    ) {
      return;
    }

    managingRef.current = true;
    setIsManaging(true);
    setError(null);
    setManagementMessage(null);

    try {
      const response = await fetch("/api/wish", { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as {
        error?: unknown;
      } | null;

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to delete your wish right now.",
        );
      }

      setDeleted(true);
    } catch (managementError) {
      setError(
        managementError instanceof Error
          ? managementError.message
          : "Unable to delete your wish right now.",
      );
    } finally {
      managingRef.current = false;
      setIsManaging(false);
    }
  }  if (isLoading) {
    return <p className="status">Loading your wish...</p>;
  }

  if (deleted) {
    return (
      <div className="journey-card wish-deleted-card">
        <p className="eyebrow">Wish deleted</p>
        <h1>Your wish has been deleted.</h1>
        <p className="journey-lede">
          It can no longer be found or receive future reminders. Existing
          reminder and reflection history remains safely stored in the
          database.
        </p>
        <Link className="button button-primary" href="/">
          Return Home
        </Link>
      </div>
    );
  }
  if (!wish) {
    return (
      <div className="journey-card">
        <p className="eyebrow">Return link</p>
        <h1>We could not open this wish.</h1>
        <p className="journey-lede">
          {error ?? "This return link is not valid."}
        </p>
        <Link className="button button-primary" href="/find">
          Find My Wish
        </Link>
      </div>
    );
  }

  return (
    <div className="wish-return-page">
      <header className="wish-return-header">
        <p className="eyebrow">Your wish has come back</p>
        <h1>Your wish has come back.</h1>
        <p className="journey-lede">
          Take a quiet moment to see how it feels now.
        </p>
      </header>

      <form className="journey-card wish-return-form" onSubmit={handleSubmit}>
        <div className="field">
          <label className="label" htmlFor="returned-wish-content">
            Your wish
          </label>
          <textarea
            className="textarea wish-textarea"
            id="returned-wish-content"
            maxLength={200}
            onChange={(event) => setWishContent(event.target.value)}
            rows={4}
            value={wishContent}
          />
          <p className="character-count">{wishContent.length} / 200</p>
        </div>

        <fieldset className="choice-fieldset">
          <legend className="label">What feels true right now?</legend>
          {RESPONSE_OPTIONS.map((option) => (
            <label
              className={`choice-card ${responseType === option.value ? "is-selected" : ""}`}
              key={option.value}
            >
              <input
                checked={responseType === option.value}
                name="responseType"
                onChange={() => setResponseType(option.value)}
                type="radio"
                value={option.value}
              />
              <span>
                <strong>{option.title}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </fieldset>

        {responseType === "something_changed" ||
        responseType === "future_note" ? (
          <div className="field">
            <label className="label" htmlFor="reflection-note">
              {responseType === "future_note"
                ? "Note to your future self"
                : "What has changed?"}
            </label>
            <textarea
              className="textarea reflection-note"
              id="reflection-note"
              maxLength={1000}
              onChange={(event) => setNote(event.target.value)}
              placeholder={
                responseType === "future_note"
                  ? "Leave a thought for later"
                  : "I made progress."
              }
              rows={3}
              value={note}
            />
          </div>
        ) : null}

        {responseType === "remind_later" ? (
          <div className="reminder-section">
            <h2>When should we bring it back?</h2>
            <div className="reminder-options">
              {[1, 3, 6, 12].map((months) => (
                <label
                  className={`reminder-chip ${remindMonths === months ? "is-selected" : ""}`}
                  key={months}
                >
                  <input
                    checked={remindMonths === months}
                    name="remindMonths"
                    onChange={() => setRemindMonths(months)}
                    type="radio"
                    value={months}
                  />
                  {months} {months === 1 ? "month" : "months"}
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="status status-error" role="alert">
            {error}
          </p>
        ) : null}

        {saved ? (
          <p className="status status-success" role="status">
            Your reflection has been saved.
          </p>
        ) : null}

        <button
          className="button button-primary continue-button"
          disabled={isSaving || wishContent.trim().length === 0}
          type="submit"
        >
          {isSaving ? "Saving..." : "Save My Reflection"}
        </button>
      </form>

      <section className="wish-management" aria-labelledby="manage-wish-heading">
        <h2 id="manage-wish-heading">Manage this wish</h2>
        <p>
          Stop future reminders or permanently remove this wish from Find and
          future emails.
        </p>
        {managementMessage ? (
          <p className="status status-success" role="status">
            {managementMessage}
          </p>
        ) : null}
        <div className="wish-management-actions">
          <button
            className="button button-secondary"
            disabled={isManaging}
            onClick={stopFutureReminders}
            type="button"
          >
            {isManaging ? "Please wait..." : "Stop future reminders"}
          </button>
          <button
            className="button button-danger"
            disabled={isManaging}
            onClick={deleteWish}
            type="button"
          >
            Delete Wish
          </button>
        </div>
      </section>
    </div>
  );
}



