import Link from "next/link";

import { WishBottleIllustration } from "./WishBottleIllustration";

type WishConfirmationProps = {
  name: string;
  wishCode: string;
  createdAt: string;
  reminder: string;
  onReset: () => void;
};

export function WishConfirmation({
  name,
  wishCode,
  createdAt,
  reminder,
  onReset,
}: WishConfirmationProps) {
  const savedDate = new Date(createdAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <section aria-live="polite" className="confirmation-block">
      <div className="confirmation-ribbon">Your wish is saved</div>
      <div className="confirmation-card">
        <WishBottleIllustration className="confirmation-art" />

        <div className="confirmation-heading">
          <p className="eyebrow">A little light, kept safe</p>
          <h1>Your wish has been saved!</h1>
          <p>
            Keep your Wish Code and PIN close so you can find this wish again.
          </p>
        </div>

        <div className="confirmation-code-hero">
          <p>Your Wish Code</p>
          <output className="wish-code">{wishCode}</output>
          <span>Take a screenshot or write it down somewhere safe.</span>
        </div>

        <dl className="confirmation-meta-grid">
          <div>
            <dt>Name</dt>
            <dd>{name}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{savedDate}</dd>
          </div>
          <div>
            <dt>Reminder</dt>
            <dd>{reminder}</dd>
          </div>
        </dl>

        <div className="confirmation-actions">
          <Link className="button button-primary" href="/find">
            View My Wish
          </Link>
          <button
            className="button button-secondary"
            onClick={onReset}
            type="button"
          >
            Make Another Wish
          </button>
        </div>
      </div>
      <p className="confirmation-note">Good things take time.</p>
    </section>
  );
}
