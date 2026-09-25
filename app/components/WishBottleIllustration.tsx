import { WISH_BOTTLE_PATH } from "./wishBottleArtwork";

type WishBottleIllustrationProps = {
  className?: string;
};

export function WishBottleIllustration({
  className = "",
}: WishBottleIllustrationProps) {
  return (
    <svg
      aria-hidden="true"
      className={`bottle-illustration ${className}`.trim()}
      viewBox="0 0 220 260"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect className="bottle-cork" x="91" y="22" width="38" height="18" rx="8" />
      <path
        className="bottle-outline"
        d={WISH_BOTTLE_PATH}
      />
      <rect className="bottle-note" x="75" y="132" width="70" height="58" rx="8" />
      <path
        className="bottle-note-line"
        d="M89 151h42M89 165h42M101 179h18"
      />
      <path
        className="bottle-heart"
        d="M110 119c-7-14-27-10-27 5 0 12 14 22 27 31 13-9 27-19 27-31 0-15-20-19-27-5Z"
      />
      <circle className="bottle-spark" cx="48" cy="72" r="5" />
      <circle className="bottle-spark" cx="174" cy="100" r="7" />
      <path className="bottle-spark-line" d="M171 64v14M164 71h14" />
    </svg>
  );
}
