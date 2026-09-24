/**
 * The Firefly brand mark — the exact same glowing firefly as the favicon
 * (src/app/icon.svg), inline so it can be the site logo. Transparent, static:
 * it never changes with the night-sky `/style`. Decorative (aria-hidden).
 */
export function FireflyMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      className={className}
      aria-hidden
      focusable="false"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <radialGradient id="ffm-bloom" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(64 74) scale(54)">
          <stop stopColor="#ffb267" stopOpacity="0.55" />
          <stop offset="0.4" stopColor="#ff8f3c" stopOpacity="0.18" />
          <stop offset="1" stopColor="#ff8f3c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ffm-lantern" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(64 84) scale(22)">
          <stop stopColor="#fff4d6" />
          <stop offset="0.4" stopColor="#ffb35a" />
          <stop offset="0.62" stopColor="#ec6a1f" stopOpacity="0.9" />
          <stop offset="1" stopColor="#e0601a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ffm-thorax" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(64 50) scale(8 14)">
          <stop stopColor="#ffc078" stopOpacity="0.8" />
          <stop offset="0.7" stopColor="#ffc078" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffc078" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g transform="translate(64 66) scale(1.5) translate(-64 -74)">
        <circle cx="64" cy="74" r="54" fill="url(#ffm-bloom)" />
        <ellipse cx="48" cy="58" rx="11" ry="19" transform="rotate(-28.6 48 58)" fill="#ffdcae" opacity="0.4" />
        <ellipse cx="80" cy="58" rx="11" ry="19" transform="rotate(28.6 80 58)" fill="#ffdcae" opacity="0.4" />
        <ellipse cx="64" cy="50" rx="8" ry="14" fill="url(#ffm-thorax)" />
        <ellipse cx="64" cy="84" rx="15" ry="20" fill="url(#ffm-lantern)" />
      </g>
    </svg>
  );
}
