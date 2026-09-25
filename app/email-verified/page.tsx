import Link from "next/link";

type EmailVerifiedPageProps = {
  searchParams: Promise<{ result?: string }>;
};

const PAGE_CONTENT = {
  success: {
    heading: "Email verified",
    message:
      "Your email address has been verified successfully. Future reminders and PIN recovery can now use it.",
  },
  expired: {
    heading: "This verification link has expired.",
    message: "Request a new verification email and use the newest link.",
  },
  used: {
    heading: "This verification link has already been used.",
    message:
      "This email may already be verified. If not, request a new verification email.",
  },
  invalid: {
    heading: "This verification link is not valid.",
    message:
      "The link is incomplete, was replaced by a newer link, or does not belong to a WishBottle email.",
  },
  error: {
    heading: "We could not verify this link right now.",
    message: "Please try again later or request a new verification email.",
  },
} as const;

export default async function EmailVerifiedPage({
  searchParams,
}: EmailVerifiedPageProps) {
  const { result } = await searchParams;
  const content =
    result === "success" ||
    result === "expired" ||
    result === "used" ||
    result === "invalid" ||
    result === "error"
      ? PAGE_CONTENT[result]
      : PAGE_CONTENT.invalid;

  return (
    <div className="journey-shell">
      <div className="journey-card">
        <p className="eyebrow">Email verification</p>
        <h1>{content.heading}</h1>
        <p className="journey-lede">{content.message}</p>
        <Link className="button button-primary" href="/">
          Return Home
        </Link>
      </div>
    </div>
  );
}
