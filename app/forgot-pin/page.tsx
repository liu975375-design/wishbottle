import type { Metadata } from "next";

import { ForgotPinForm } from "@/app/components/ForgotPinForm";

export const metadata: Metadata = {
  title: "Forgot Your PIN? | WishBottle",
};

type ForgotPinPageProps = {
  searchParams: Promise<{ wishCode?: string }>;
};

export default async function ForgotPinPage({
  searchParams,
}: ForgotPinPageProps) {
  const { wishCode = "" } = await searchParams;

  return (
    <div className="content-page forgot-pin-page">
      <header className="centered-page-heading">
        <h1>Forgot your PIN?</h1>
        <p>
          Enter the email associated with your wish and your Wish Code.
          We&apos;ll send you a PIN reset link.
        </p>
      </header>
      <ForgotPinForm initialWishCode={wishCode} />
    </div>
  );
}
