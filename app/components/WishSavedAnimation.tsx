"use client";

import { useEffect, useId, useRef, useState } from "react";

import { WISH_BOTTLE_PATH } from "./wishBottleArtwork";

type WishSavedAnimationProps = {
  wishCode: string;
  wishContent: string;
  confirmed: boolean;
  onComplete?: () => void;
};

function splitWishContent(value: string): [string, string] {
  const compact = value.replace(/\s+/g, " ").trim();

  if (compact.length <= 26) {
    return [compact, ""];
  }

  const firstBreak = compact.lastIndexOf(" ", 26);
  const firstEnd = firstBreak > 10 ? firstBreak : 26;

  return [compact.slice(0, firstEnd), compact.slice(firstEnd + 1, firstEnd + 27)];
}

export function WishSavedAnimation({
  wishCode,
  wishContent,
  confirmed,
  onComplete,
}: WishSavedAnimationProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const confirmedRef = useRef(confirmed);
  const onCompleteRef = useRef(onComplete);
  const revealSuccessRef = useRef<() => void>(() => undefined);
  const timelineRef = useRef<{ kill: () => void; progress: (value: number) => void } | null>(null);
  const skipRequestedRef = useRef(false);
  const visualFinishedRef = useRef(false);
  const successShownRef = useRef(false);
  const [showSkip, setShowSkip] = useState(true);
  const uid = useId().replace(/:/g, "");
  const glassGradientId = `wish-glass-${uid}`;
  const glassEdgeId = `wish-glass-edge-${uid}`;
  const paperGradientId = `wish-paper-${uid}`;
  const corkGradientId = `wish-cork-${uid}`;
  const glowGradientId = `wish-glow-${uid}`;
  const shadowGradientId = `wish-shadow-${uid}`;
  const [wishLineOne, wishLineTwo] = splitWishContent(wishContent);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let mounted = true;
    let context: { revert: () => void } | undefined;
    let motionMedia: ReturnType<typeof import("gsap").gsap.matchMedia> | undefined;

    async function setupAnimation() {
      const [{ gsap }, motionPathModule] = await Promise.all([
        import("gsap"),
        import("gsap/MotionPathPlugin"),
      ]);
      const MotionPathPlugin = motionPathModule.default;

      if (!mounted || !rootRef.current) {
        return;
      }

      gsap.registerPlugin(MotionPathPlugin);
      const root = rootRef.current;
      const q = gsap.utils.selector(root);
      const note = q(".wish-note-group");
      const noteLines = q(".wish-note-line");
      const scroll = q(".wish-scroll-group");
      const scrollCopy = q(".wish-scroll-copy");
      const cork = q("#wishCork");
      const corkShadow = q(".wish-cork-shadow");
      const sparkles = q(".wish-sparkle");

      const setFinalVisualState = () => {
        gsap.set(note, { autoAlpha: 0 });
        gsap.set(scroll, { autoAlpha: 1, x: 0, y: 0, scale: 1, rotation: -2 });
        gsap.set(scrollCopy, { autoAlpha: 0 });
        gsap.set(cork, { y: 0, rotation: 0 });
        gsap.set(corkShadow, { autoAlpha: 0.42 });
        gsap.set(sparkles, { autoAlpha: 0.82, scale: 1 });
      };

      const revealSuccess = () => {
        if (successShownRef.current) {
          return;
        }

        successShownRef.current = true;
        setShowSkip(false);

        const successTimeline = gsap.timeline({
          onComplete: () => {
            onCompleteRef.current?.();
          },
        });

        successTimeline
          .fromTo(
            q(".wish-success-overlay"),
            { autoAlpha: 0, y: 14 },
            { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" },
            0,
          )
          .to({}, { duration: 0.55 }, 0.45);
      };

      revealSuccessRef.current = revealSuccess;

      const finishVisualSequence = () => {
        if (visualFinishedRef.current) {
          return;
        }

        visualFinishedRef.current = true;
        setShowSkip(false);

        if (confirmedRef.current) {
          revealSuccess();
        }
      };

      context = gsap.context(() => {
        motionMedia = gsap.matchMedia();

        motionMedia.add(
          "(prefers-reduced-motion: reduce)",
          () => {
            setFinalVisualState();
            finishVisualSequence();
          },
          root,
        );

        motionMedia.add(
          "(prefers-reduced-motion: no-preference)",
          () => {
            if (skipRequestedRef.current) {
              setFinalVisualState();
              finishVisualSequence();
              return;
            }

            gsap.set(note, {
              autoAlpha: 0,
              y: 18,
              scale: 0.92,
              rotation: -1.5,
              transformOrigin: "50% 50%",
            });
            gsap.set(noteLines, { autoAlpha: 0, y: 5 });
            gsap.set(scroll, {
              autoAlpha: 0,
              x: 0,
              y: 0,
              scaleX: 0.2,
              scaleY: 0.96,
              rotation: -2,
              transformOrigin: "50% 50%",
            });
            gsap.set(scrollCopy, { autoAlpha: 0 });
            gsap.set(cork, { y: -28, rotation: -4, transformOrigin: "50% 50%" });
            gsap.set(corkShadow, { autoAlpha: 0 });
            gsap.set(sparkles, { autoAlpha: 0, scale: 0.35, transformOrigin: "50% 50%" });

            const timeline = gsap.timeline({
              defaults: { ease: "power2.out" },
              onComplete: finishVisualSequence,
            });

            timeline
              .addLabel("wishAppears", 0)
              .to(
                note,
                {
                  autoAlpha: 1,
                  y: 0,
                  scale: 1,
                  rotation: -1.5,
                  duration: 0.6,
                },
                "wishAppears",
              )
              .to(
                noteLines,
                {
                  autoAlpha: 1,
                  y: 0,
                  duration: 0.35,
                  stagger: 0.12,
                },
                0.28,
              )
              .addLabel("paperRolls", 0.78)
              .to(
                note,
                {
                  scaleX: 0.16,
                  scaleY: 0.96,
                  rotation: -3,
                  duration: 0.62,
                  ease: "sine.inOut",
                },
                "paperRolls",
              )
              .to(note, { autoAlpha: 0, duration: 0.18 }, 1.35)
              .to(
                scroll,
                {
                  autoAlpha: 1,
                  scaleX: 1,
                  scaleY: 1,
                  duration: 0.24,
                },
                1.25,
              )
              .addLabel("scrollFloats", 1.4)
              .to(
                scroll,
                {
                  motionPath: {
                    path: "#wishMotionPath",
                    align: "#wishMotionPath",
                    alignOrigin: [0.5, 0.5],
                    start: 0,
                    end: 1,
                  },
                  rotation: -1,
                  duration: 1.42,
                  ease: "power2.inOut",
                },
                "scrollFloats",
              )
              .to(scrollCopy, { autoAlpha: 0, duration: 0.16 }, 2.64)
              .addLabel("corkCloses", 2.55)
              .to(
                cork,
                {
                  y: 0,
                  rotation: 0,
                  duration: 0.38,
                  ease: "power2.inOut",
                },
                "corkCloses",
              )
              .to(corkShadow, { autoAlpha: 0.42, duration: 0.22 }, 2.76)
              .addLabel("sparklesAppear", 2.86)
              .to(
                sparkles,
                {
                  autoAlpha: 0.82,
                  scale: 1,
                  duration: 0.5,
                  stagger: 0.08,
                  ease: "sine.out",
                },
                "sparklesAppear",
              )
              .to({}, { duration: 0.3 }, 3.35);

            timelineRef.current = timeline;
          },
          root,
        );
      }, root);
    }

    void setupAnimation();

    return () => {
      mounted = false;
      timelineRef.current?.kill();
      motionMedia?.revert();
      context?.revert();
    };
  }, [wishContent]);

  useEffect(() => {
    confirmedRef.current = confirmed;

    if (confirmed && visualFinishedRef.current) {
      revealSuccessRef.current();
    }
  }, [confirmed]);

  function handleSkip() {
    skipRequestedRef.current = true;
    timelineRef.current?.progress(1);
    timelineRef.current?.kill();
    setShowSkip(false);

    if (!visualFinishedRef.current) {
      visualFinishedRef.current = true;
      if (confirmedRef.current) {
        revealSuccessRef.current();
      }
    }
  }

  return (
    <div className="wish-saved-animation" ref={rootRef}>
      <div className="wish-animation-stage">
        <svg
          aria-hidden="true"
          className="wish-animation-svg"
          focusable="false"
          viewBox="0 0 420 420"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id={glowGradientId} cx="50%" cy="36%" r="72%">
              <stop offset="0" stopColor="#fff9ed" stopOpacity="1" />
              <stop offset="0.58" stopColor="#f7ece4" stopOpacity="0.9" />
              <stop offset="1" stopColor="#e8d9d1" stopOpacity="0.38" />
            </radialGradient>
            <linearGradient id={glassGradientId} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.86" />
              <stop offset="0.48" stopColor="#d9e9e8" stopOpacity="0.34" />
              <stop offset="1" stopColor="#f3dfd8" stopOpacity="0.52" />
            </linearGradient>
            <linearGradient id={glassEdgeId} x1="0" x2="1" y1="0" y2="0.8">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.98" />
              <stop offset="0.5" stopColor="#b9d6d8" stopOpacity="0.86" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0.94" />
            </linearGradient>
            <linearGradient id={paperGradientId} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#fffef9" />
              <stop offset="0.62" stopColor="#fff8e8" />
              <stop offset="1" stopColor="#f2e5d0" />
            </linearGradient>
            <linearGradient id={corkGradientId} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#eac99f" />
              <stop offset="0.55" stopColor="#d6a876" />
              <stop offset="1" stopColor="#bd8654" />
            </linearGradient>
            <radialGradient id={shadowGradientId} cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#354957" stopOpacity="0.24" />
              <stop offset="1" stopColor="#354957" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect className="wish-scene-base" fill={`url(#${glowGradientId})`} height="420" width="420" />
          <path className="wish-sea-horizon" d="M0 300c44-9 87-10 130-1 53 12 107 9 151-3 49-14 90-12 139-1v125H0Z" />
          <ellipse className="wish-sand-shadow" cx="237" cy="342" rx="92" ry="15" fill={`url(#${shadowGradientId})`} />

          <g className="wish-bottle-group" transform="translate(110 78) scale(1.16)">
            <path
              className="wish-bottle-glass"
              d={WISH_BOTTLE_PATH}
              fill={`url(#${glassGradientId})`}
              stroke={`url(#${glassEdgeId})`}
            />
            <path className="wish-bottle-inner-shadow" d={WISH_BOTTLE_PATH} />
            <path className="wish-glass-highlight-left" d="M72 118c-10 24-12 54-6 82" />
            <path className="wish-glass-highlight-right" d="M145 146c7 23 7 50 0 73" />
            <path className="wish-glass-base" d="M67 218c12 13 30 19 48 18" />
            <ellipse className="wish-bottle-mouth" cx="110" cy="40" rx="19" ry="5" />
            <g id="wishCork">
              <rect className="wish-cork-shadow" x="94" y="22" width="34" height="29" rx="10" />
              <rect className="wish-cork-body" x="95" y="15" width="32" height="32" rx="9" fill={`url(#${corkGradientId})`} />
              <ellipse className="wish-cork-top" cx="111" cy="15" rx="16" ry="4" />
              <path className="wish-cork-grain" d="M99 25c7-2 15-2 23 1M101 33c6-2 12-2 19 1" />
            </g>
          </g>

          <g className="wish-sparkle-group">
            <path className="wish-sparkle" d="M0-8C1-3 3-1 8 0C3 1 1 3 0 8C-1 3-3 1-8 0C-3-1-1-3 0-8Z" transform="translate(116 125)" />
            <path className="wish-sparkle" d="M0-6C0.8-2 2-0.8 6 0C2 0.8 0.8 2 0 6C-0.8 2-2 0.8-6 0C-2-0.8-0.8-2 0-6Z" transform="translate(322 116)" />
            <circle className="wish-sparkle" cx="334" cy="206" r="3" />
            <circle className="wish-sparkle" cx="82" cy="80" r="2.4" />
          </g>

          <path className="wish-motion-path" d="M214 116C214 146 219 177 238 207" fill="none" id="wishMotionPath" />

          <g className="wish-note-group">
            <rect className="wish-note-shadow" x="113" y="65" width="200" height="108" rx="8" />
            <rect className="wish-note-paper" x="108" y="60" width="200" height="108" rx="8" fill={`url(#${paperGradientId})`} />
            <path className="wish-note-fold" d="M282 60h26v26" />
            <text className="wish-note-line" x="128" y="99">{wishLineOne}</text>
            <text className="wish-note-line" x="128" y="128">{wishLineTwo}</text>
            <path className="wish-note-rule" d="M128 144h78M128 153h54" />
          </g>

          <g className="wish-scroll-group">
            <rect className="wish-scroll-shadow" x="169" y="100" width="92" height="48" rx="7" />
            <rect className="wish-scroll-paper" x="164" y="95" width="92" height="48" rx="7" fill={`url(#${paperGradientId})`} />
            <rect className="wish-scroll-edge" x="158" y="93" width="14" height="52" rx="7" />
            <rect className="wish-scroll-edge" x="248" y="93" width="14" height="52" rx="7" />
            <path className="wish-scroll-ribbon" d="M191 139c15-7 28 7 39-1" />
            <path className="wish-scroll-copy" d="M178 111h60M178 120h42" />
          </g>
        </svg>

        <div className="wish-success-overlay" role="status">
          <p>Your Wish is Saved</p>
          <span>Wish Code</span>
          <output>{wishCode}</output>
        </div>

        {showSkip ? (
          <button
            aria-label="Skip saved wish animation"
            className="wish-skip-button"
            onClick={handleSkip}
            type="button"
          >
            Skip
          </button>
        ) : null}
      </div>

      <p className="sr-only">
        Your wish is saved. Wish Code: {wishCode}. Your wish: {wishContent}
      </p>
    </div>
  );
}
