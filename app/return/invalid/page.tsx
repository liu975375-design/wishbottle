import Link from "next/link";

export default function InvalidReturnPage() {
  return (
    <div className="journey-shell">
      <div className="journey-card">
        <p className="eyebrow">Return link</p>
        <h1>This link is no longer available.</h1>
        <p className="journey-lede">
          The link may have expired or already been used. You can still find
          your wish with your Wish Code and PIN.
        </p>
        <Link className="button button-primary" href="/find">
          Find My Wish
        </Link>
      </div>
    </div>
  );
}
