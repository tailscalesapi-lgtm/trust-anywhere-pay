export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="Fair Trade logo">
      <defs>
        <clipPath id="left">
          <path d="M50 0 A50 50 0 0 0 50 100 A25 25 0 0 1 50 50 A25 25 0 0 0 50 0 Z" />
        </clipPath>
        <clipPath id="right">
          <path d="M50 0 A50 50 0 0 1 50 100 A25 25 0 0 0 50 50 A25 25 0 0 1 50 0 Z" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="48" fill="none" stroke="oklch(0.78 0.14 220)" strokeWidth="2" />
      <rect width="100" height="100" fill="oklch(0.78 0.14 220)" clipPath="url(#left)" />
      <rect width="100" height="100" fill="oklch(0.82 0.18 115)" clipPath="url(#right)" />
      <circle cx="50" cy="25" r="6" fill="oklch(0.82 0.18 115)" />
      <circle cx="50" cy="75" r="6" fill="oklch(0.78 0.14 220)" />
    </svg>
  );
}
