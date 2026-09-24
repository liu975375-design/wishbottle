import Link from "next/link";

type EmailVerifiedPageProps = {
  searchParams: Promise<{ result?: string }>;
};

export default async function EmailVerifiedPage({
  searchParams,
}: EmailVerifiedPageProps) {
  const { result } = await searchParams;
  const success = result === "success";

  return (
    <div className="journey-shell">
      <div className="journey-card">
        <p className="eyebrow">Email verification</p>
        <h1>{success ? "Your email is verified." : "This link is not valid."}</h1>
        <p className="journey-lede">
          {success
            ? "Future reminders and PIN recovery can now use this verified email."
            : "The link may be expired or already used."}
        </p>
        <Link className="button button-primary" href="/">
          Return Home
        </Link>
      </div>
    </div>
  );
}
