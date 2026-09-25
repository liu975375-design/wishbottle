"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type FoundWish = {
  wishCode: string;
  wishContent: string;
  createdAt: string;
};

const FOUND_WISH_STORAGE_KEY = "wishbottle:found-wish";

function CopyIcon({ copied }: { copied: boolean }) {
  return (
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
  );
}

export function FoundWishView() {
  const router = useRouter();
  const [wish, setWish] = useState<FoundWish | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const copyResetTimerRef = useRef<number | null>(null);
  const wishCodeRef = useRef<HTMLOutputElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.sessionStorage.getItem(FOUND_WISH_STORAGE_KEY);

        if (!stored) {
          router.replace("/find");
          return;
        }

        const parsed = JSON.parse(stored) as Partial<FoundWish>;

        if (
          typeof parsed.wishCode !== "string" ||
          typeof parsed.wishContent !== "string" ||
          typeof parsed.createdAt !== "string"
        ) {
          window.sessionStorage.removeItem(FOUND_WISH_STORAGE_KEY);
          router.replace("/find");
          return;
        }

        setWish({
          wishCode: parsed.wishCode,
          wishContent: parsed.wishContent,
          createdAt: parsed.createdAt,
        });
      } catch {
        window.sessionStorage.removeItem(FOUND_WISH_STORAGE_KEY);
        router.replace("/find");
      } finally {
        setIsLoading(false);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [router]);

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

    if (!output || !wish) {
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
  }, [wish]);

  async function copyWishCode() {
    if (!wish) {
      return;
    }

    try {
      await navigator.clipboard.writeText(wish.wishCode);
    } catch {
      const temporaryInput = document.createElement("textarea");
      temporaryInput.value = wish.wishCode;
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

  if (isLoading || !wish) {
    return (
      <div className="found-wish-loading" role="status">
        Opening your wish...
      </div>
    );
  }

  const savedDate = new Date(wish.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <article className="found-wish-page">
      <p className="eyebrow">Wish found</p>
      <h1>Here is your wish.</h1>
      <p className="found-wish-lede">
        A quiet moment with the words you chose to keep.
      </p>

      <blockquote className="found-wish-content">{wish.wishContent}</blockquote>

      <div className="found-wish-info-card">
        <div className="found-wish-code-detail">
          <div className="found-wish-code-value">
            <span>Wish Code</span>
            <output ref={wishCodeRef}>{wish.wishCode}</output>
          </div>
          <button
            aria-live="polite"
            className={`found-wish-copy ${copied ? "is-copied" : ""}`}
            onClick={copyWishCode}
            type="button"
          >
            <CopyIcon copied={copied} />
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>

        <div className="found-wish-saved-date">
          <span>Saved Date</span>
          <time dateTime={wish.createdAt}>{savedDate}</time>
        </div>
      </div>

      <p className="hint">Keep your Wish Code and PIN somewhere safe.</p>

      <div className="found-wish-actions">
        <Link className="button button-primary" href="/">
          Return Home
        </Link>
        <Link className="button button-secondary" href="/find">
          Find Another Wish
        </Link>
      </div>
    </article>
  );
}
