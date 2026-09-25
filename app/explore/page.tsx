import Image from "next/image";
import Link from "next/link";

const JOURNEYS = [
  {
    title: "Weddings",
    description: "Love, new beginnings, and happy ever afters.",
    image: "/assets/journey-weddings.jpg",
  },
  {
    title: "Communities",
    description: "Wishes that bring people together.",
    image: "/assets/journey-communities.jpg",
  },
  {
    title: "Seasonal Journeys",
    description: "Celebrate the seasons with special wishes.",
    image: "/assets/journey-seasonal.jpg",
  },
];

export default function ExplorePage() {
  return (
    <div className="content-page explore-page">
      <header className="centered-page-heading">
        <h1>Explore Special Journeys</h1>
        <p>Different moments. Meaningful wishes.</p>
      </header>

      <div className="journey-list">
        {JOURNEYS.map((journey) => (
          <Link className="journey-card-row" href="/create" key={journey.title}>
            <span className="journey-card-image">
              <Image alt="" fill sizes="96px" src={journey.image} />
            </span>
            <span className="journey-card-copy">
              <strong>{journey.title}</strong>
              <small>{journey.description}</small>
            </span>
            <svg aria-hidden="true" viewBox="0 0 20 20">
              <path d="m8 5 5 5-5 5" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
