import type { Metadata } from "next";

import { FindWishForm } from "@/app/components/FindWishForm";

export const metadata: Metadata = {
  title: "Find My Wish | WishBottle",
};

type FindWishPageProps = {
  searchParams: Promise<{ wishCode?: string }>;
};

export default async function FindWishPage({
  searchParams,
}: FindWishPageProps) {
  const { wishCode = "" } = await searchParams;

  return (
    <div className="content-page find-page-shell">
      <header className="centered-page-heading">
        <h1>Find My Wish</h1>
        <p>
          Enter your Wish Code and PIN
          <br />
          to open your wish.
        </p>
      </header>
      <FindWishForm initialWishCode={wishCode} />
    </div>
  );
}
