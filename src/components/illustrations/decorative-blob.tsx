import type { IllustrationProps } from "./types";

interface DecorativeBlobProps extends IllustrationProps {
  /** A CSS color (defaults to the brand primary at low opacity). */
  color?: string;
}

/**
 * A single reusable soft organic background shape, meant to sit *behind*
 * another illustration or a hero heading — never used alone as content.
 * One hand-drawn path shared everywhere so every "soft background" in the
 * app reads as the same shape language rather than a new blob per screen.
 */
export function DecorativeBlob({ size = 200, className, color }: DecorativeBlobProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M45 32C68 12 108 8 136 24C164 40 178 74 172 106C166 138 140 166 106 174C72 182 34 172 18 144C2 116 8 80 22 58C29 47 36 39 45 32Z"
        fill={color ?? "var(--primary)"}
        opacity={color ? undefined : 0.08}
      />
    </svg>
  );
}
