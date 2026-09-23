import Link from "next/link";

import { FindWishForm } from "@/app/components/FindWishForm";

export default function FindWishPage() {
  return (
    <div className="find-page-shell">
      <Link className="back-link" href="/">
        Back to WishBottle
      </Link>
      <section className="find-heading">
        <p className="eyebrow">Find My Wish</p>
        <h1>Find your wish</h1>
        <p className="journey-lede">
          Enter your Wish Code and PIN to find it again.
        </p>
      </section>
      <FindWishForm />
    </div>
  );
}
