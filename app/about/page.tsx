import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="content-page about-page">
      <header className="centered-page-heading">
        <h1>About WishBottle</h1>
        <p>A quiet place for the wishes you want to keep.</p>
      </header>

      <div className="about-copy">
        <p>
          WishBottle keeps a private wish, a Wish Code, and a PIN together so
          you can return to what mattered when you wrote it.
        </p>
        <p>
          No public feed. No performance. Just a thoughtful place to hold a
          wish until the right moment comes back around.
        </p>
      </div>

      <Link className="button button-primary" href="/create">
        Make a New Wish
      </Link>
    </div>
  );
}
