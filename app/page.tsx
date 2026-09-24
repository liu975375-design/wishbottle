import Link from "next/link";

import { WishBottleIllustration } from "./components/WishBottleIllustration";

export default function HomePage() {
  return (
    <>
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow">WISHBOTTLE</p>
          <h1>
            Make a wish.
            <br />
            Keep it close.
          </h1>
          <p className="home-lede">
            Create a private wish, then use your Wish Code and PIN to find it
            again.
          </p>
          <div className="home-actions">
            <Link className="button button-primary" href="/create">
              Make a New Wish
            </Link>
            <Link className="button button-secondary" href="/find">
              Find My Wish
            </Link>
          </div>
        </div>
        <div className="home-hero-art">
          <div className="hero-glow" aria-hidden="true" />
          <WishBottleIllustration />
          <p className="art-caption">A little hope, held safely.</p>
        </div>
      </section>


      <section className="home-signoff">
        <span aria-hidden="true" className="tiny-heart">
          ♡
        </span>
        <p>
          Small wishes.
          <br />
          Brighter tomorrows.
        </p>
      </section>
    </>
  );
}

