/**
 * DeveloperIcon — flat "lineal color" developer avatar used for the Settings
 * → Developer navigation item.
 *
 * Hand-traced SVG conversion of the attached PNG: a person (hair + face + ears,
 * green shirt) above a blue "DEV" sign. Unlike the monochrome {@link EntityIcon}
 * glyphs this is a multicolor mark, so it renders directly (no colored tile) —
 * matching how this nav item previously used a plain lucide icon.
 *
 * Scales with `size`; the 512×512 viewBox preserves the source proportions.
 */

interface DeveloperIconProps {
  /** Rendered width/height in px. Defaults to 18 to match the sidebar rail. */
  size?: number;
  className?: string;
}

/** Multicolor developer-avatar glyph (traced from the source artwork). */
export function DeveloperIcon({ size = 18, className }: DeveloperIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Ears */}
      <ellipse cx="184" cy="150" rx="24" ry="28" fill="#FCD7AE" stroke="#000" strokeWidth="14" />
      <ellipse cx="328" cy="150" rx="24" ry="28" fill="#FCD7AE" stroke="#000" strokeWidth="14" />

      {/* Neck */}
      <path
        d="M230 196 L230 250 C230 264 242 274 256 274 C270 274 282 264 282 250 L282 196 Z"
        fill="#F6C794"
        stroke="#000"
        strokeWidth="14"
        strokeLinejoin="round"
      />

      {/* Shirt / shoulders */}
      <path
        d="M146 348 L146 304 C146 270 174 244 208 244 L304 244 C338 244 366 270 366 304 L366 348 Z"
        fill="#7CE8B0"
        stroke="#000"
        strokeWidth="14"
        strokeLinejoin="round"
      />
      {/* Shirt shadow (right half) */}
      <path
        d="M256 244 L304 244 C338 244 366 270 366 304 L366 348 L256 348 Z"
        fill="#4FD8A0"
      />

      {/* Face */}
      <path
        d="M182 118 C182 100 198 88 256 88 C314 88 330 100 330 118 L330 158 C330 196 298 222 256 222 C214 222 182 196 182 158 Z"
        fill="#FCD7AE"
        stroke="#000"
        strokeWidth="14"
        strokeLinejoin="round"
      />

      {/* Hair */}
      <path
        d="M174 142 C162 64 210 30 256 30 C302 30 350 64 338 142 C330 116 308 100 286 98 C282 116 262 130 232 130 C210 130 192 124 174 142 Z"
        fill="#5E5668"
        stroke="#000"
        strokeWidth="14"
        strokeLinejoin="round"
      />

      {/* DEV sign */}
      <rect x="58" y="330" width="396" height="152" rx="30" fill="#5DAEF6" />
      {/* Sign shadow (right edge) */}
      <path
        d="M412 330 L424 330 C440 330 454 344 454 360 L454 452 C454 468 440 482 424 482 L412 482 Z"
        fill="#4A9BF0"
      />
      <rect x="58" y="330" width="396" height="152" rx="30" fill="none" stroke="#000" strokeWidth="14" />

      {/* "DEV" lettering */}
      <text
        x="256"
        y="436"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="118"
        fill="#36373B"
      >
        DEV
      </text>
    </svg>
  );
}
