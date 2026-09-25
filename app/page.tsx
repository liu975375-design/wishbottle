import Image from "next/image";
import Link from "next/link";

function Arrow() {
  return (
    <svg aria-hidden="true" className="action-arrow" viewBox="0 0 16 16">
      <path d="m6 3 5 5-5 5" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <section className="home-page">
      <div className="home-story">
        <div className="home-heading-wrap">
          <h1>
            <span>Make a wish.</span>
            <span className="home-title-final">
              Keep it close.
              <svg
                aria-hidden="true"
                className="home-heart-line"
                viewBox="0 0 180 80"
              >
                <path d="M5 55c28-1 43-15 55-31 11-15 24 13 39 10 12-3 20-11 27-17 10-9 12 16 49 10" />
                <path d="M101 28c-4-15-23-17-27-3-4-15-23-15-27 1-3 17 25 28 27 29 8-5 31-15 27-27Z" />
              </svg>
            </span>
          </h1>
        </div>

        <p className="home-lede">
          Save a private wish today, and return to it later with your Wish Code
          and PIN.
        </p>

        <div aria-hidden="true" className="home-sparkle-cluster">
          <span />
          <span />
          <span />
        </div>

        <div className="home-actions">
          <Link className="button button-primary" href="/create">
            Make a New Wish
            <Arrow />
          </Link>
          <Link className="button button-secondary" href="/find">
            Find My Wish
            <Arrow />
          </Link>
          <Link className="home-explore-link" href="/explore">
            Explore Special Journeys
            <Arrow />
          </Link>
        </div>
      </div>

      <div className="home-coastal-art" aria-hidden="true">
        <Image
          alt=""
          className="home-coastal-image"
          fill
          priority
          sizes="(max-width: 640px) 100vw, 760px"
          src="/assets/home-bottle-hero.jpg"
        />
        <div className="home-coastal-wash" />
      </div>
    </section>
  );
}
