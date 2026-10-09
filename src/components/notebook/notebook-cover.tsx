"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";
import {
  getCoverTheme,
  type CoverDecorationId,
  type CoverThemeId,
} from "@/lib/notebook-covers/config";
import { CoverDecorationShape } from "./cover-decoration";
import { coverSerif } from "./cover-font";

/**
 * A notebook cover drawn entirely in SVG from the theme config — no image
 * assets, so it stays sharp at any size and costs no network on the PWA.
 * Leather/linen grain comes from an SVG noise filter clipped to the cover.
 *
 * Geometry (viewBox units): the front cover is 210×292 with its spine on the
 * left (x 0–20). `NotebookCover` adds the paper block peeking out on the
 * right/bottom behind it; `NotebookCoverFace` is the front cover alone, which
 * the opening animation rotates around its left edge.
 */
export const COVER_W = 210;
export const COVER_H = 292;
const SPINE = 20;
const CX = (SPINE + COVER_W) / 2; // optical centre of the cover, right of the spine

interface CoverProps {
  theme: CoverThemeId;
  decorations?: readonly CoverDecorationId[];
  name?: string | null;
  className?: string;
}

function CoverArt({ theme: themeId, decorations = [], name, uid }: CoverProps & { uid: string }) {
  const theme = getCoverTheme(themeId);
  const id = (part: string) => `${uid}-${part}`;
  const url = (part: string) => `url(#${id(part)})`;
  const coverPath = `M4 0 H${COVER_W - 10} Q${COVER_W} 0 ${COVER_W} 10 V${COVER_H - 10} Q${COVER_W} ${COVER_H} ${COVER_W - 10} ${COVER_H} H4 Q0 ${COVER_H} 0 ${COVER_H - 4} V4 Q0 0 4 0 Z`;
  const decoration = decorations[0];
  const strapX = COVER_W - 30;

  return (
    <>
      <defs>
        <clipPath id={id("clip")}>
          <path d={coverPath} />
        </clipPath>
        <linearGradient id={id("foil")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={theme.foil[0]} />
          <stop offset="0.35" stopColor={theme.foil[1]} />
          <stop offset="1" stopColor={theme.foil[2]} />
        </linearGradient>
        {/* Light falling from the top-left */}
        <radialGradient id={id("light")} cx="0.3" cy="0.12" r="0.95">
          <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.18" />
        </radialGradient>
        <linearGradient id={id("spine")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={theme.shade} />
          <stop offset="0.7" stopColor={theme.base} />
          <stop offset="1" stopColor={theme.shade} />
        </linearGradient>
        {theme.corner ? (
          <linearGradient id={id("corner")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={theme.corner[0]} />
            <stop offset="1" stopColor={theme.corner[1]} />
          </linearGradient>
        ) : null}
        {theme.material === "leather" ? (
          <filter id={id("grain")} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" result="fine" />
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="mottle" />
            <feBlend in="fine" in2="mottle" mode="multiply" />
            <feColorMatrix values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${theme.grain * 0.9} -0.12`} />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
        ) : (
          <filter id={id("grain")} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9 0.06" numOctaves="2" seed="5" result="h" />
            <feTurbulence type="fractalNoise" baseFrequency="0.06 0.9" numOctaves="2" seed="9" result="v" />
            <feBlend in="h" in2="v" mode="multiply" />
            <feColorMatrix values={`0 0 0 0 0.35  0 0 0 0 0.27  0 0 0 0 0.15  0 0 0 ${theme.grain * 1.2} -0.1`} />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
        )}
        <filter id={id("emboss")} x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="0.6" stdDeviation="0.35" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>

      <g clipPath={url("clip")}>
        <rect width={COVER_W} height={COVER_H} fill={theme.base} />
        <rect width={COVER_W} height={COVER_H} fill="#000" filter={url("grain")} />
        {theme.textureImage ? (
          <image href={theme.textureImage} width={COVER_W} height={COVER_H} preserveAspectRatio="xMidYMid slice" opacity="0.6" />
        ) : null}
        {/* Spine and its hinge groove */}
        <rect width={SPINE} height={COVER_H} fill={url("spine")} />
        <rect x={SPINE} width="1.2" height={COVER_H} fill="#000" opacity="0.28" />
        <rect x={SPINE + 1.2} width="0.8" height={COVER_H} fill="#fff" opacity="0.12" />
        <rect width={COVER_W} height={COVER_H} fill={url("light")} />
        {/* Embossed frame */}
        <rect
          x={SPINE + 12}
          y="14"
          width={COVER_W - SPINE - 24}
          height={COVER_H - 28}
          rx="4"
          fill="none"
          stroke={url("foil")}
          strokeWidth="0.8"
          opacity="0.6"
        />
        {/* Edge stitching */}
        <path
          d={coverPath}
          fill="none"
          stroke={theme.material === "linen" ? theme.foil[2] : theme.foil[0]}
          strokeWidth="0.7"
          strokeDasharray="2.4 2"
          opacity="0.35"
          transform={`translate(${CX} ${COVER_H / 2}) scale(0.955 0.968) translate(${-CX} ${-COVER_H / 2})`}
        />
        {/* Metal corner protectors on the opening edge */}
        {theme.corner ? (
          <g fill={url("corner")} stroke="#000" strokeOpacity="0.25" strokeWidth="0.5">
            <path d={`M${COVER_W - 22} 0 H${COVER_W} V22 Q${COVER_W - 6} 6 ${COVER_W - 22} 0 Z`} />
            <path d={`M${COVER_W - 22} ${COVER_H} H${COVER_W} V${COVER_H - 22} Q${COVER_W - 6} ${COVER_H - 6} ${COVER_W - 22} ${COVER_H} Z`} />
          </g>
        ) : null}
      </g>

      {/* Name label (optional) */}
      {name ? (
        <g>
          <rect x={CX - 46} y="34" width="92" height="22" rx="3" fill="#000" opacity="0.18" transform="translate(0.8 1.2)" />
          <rect x={CX - 46} y="34" width="92" height="22" rx="3" fill="#f6eedc" stroke={url("foil")} strokeWidth="1.2" />
          <text
            x={CX}
            y="49"
            textAnchor="middle"
            fontSize="10.5"
            fontWeight="600"
            fill="#4b3a28"
            style={{ fontFamily: "var(--font-sans), sans-serif" }}
          >
            {name}
          </text>
        </g>
      ) : null}

      {/* Botanical emblem + wordmark, foil-stamped */}
      <g filter={url("emboss")} fill={url("foil")}>
        <path
          d={`M${CX} 128 V104 M${CX} 116 C ${CX - 4} 111 ${CX - 12} 110 ${CX - 15} 104 C ${CX - 8} 103 ${CX - 2} 107 ${CX} 116 Z M${CX} 110 C ${CX + 3} 104 ${CX + 10} 101 ${CX + 15} 97 C ${CX + 15} 104 ${CX + 7} 109 ${CX} 110 Z`}
          stroke={url("foil")}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <text
          x={CX}
          y="152"
          textAnchor="middle"
          fontSize="19"
          fontWeight="600"
          letterSpacing="3.2"
          style={{ fontFamily: coverSerif.style.fontFamily }}
        >
          WEALTH OS
        </text>
        <text
          x={CX}
          y="167"
          textAnchor="middle"
          fontSize="9"
          fontStyle="italic"
          fontWeight="500"
          letterSpacing="0.4"
          style={{ fontFamily: coverSerif.style.fontFamily }}
        >
          Your Financial Journal
        </text>
      </g>

      {/* Sticker */}
      {decoration ? (
        <g transform={`translate(${SPINE + 18} ${COVER_H - 86}) rotate(-6 28 28)`}>
          <CoverDecorationShape id={decoration} />
        </g>
      ) : null}

      {/* Elastic strap */}
      {theme.strap ? (
        <g>
          <rect x={strapX + 1.5} y="0" width="9" height={COVER_H} fill="#000" opacity="0.22" />
          <rect x={strapX} y="0" width="9" height={COVER_H} fill={theme.strap} />
          <rect x={strapX + 1.2} y="0" width="1" height={COVER_H} fill="#fff" opacity="0.12" />
          <rect x={strapX + 7} y="0" width="1" height={COVER_H} fill="#000" opacity="0.2" />
        </g>
      ) : null}
    </>
  );
}

/** The front cover alone (what rotates when the notebook opens). */
export function NotebookCoverFace(props: CoverProps) {
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, "");
  return (
    <svg
      viewBox={`0 0 ${COVER_W} ${COVER_H}`}
      className={cn("block h-auto w-full", props.className)}
      role="img"
      aria-hidden="true"
    >
      <CoverArt {...props} uid={uid} />
    </svg>
  );
}

/** A closed notebook: paper block, ribbon bookmark and front cover, with a soft shadow. */
export function NotebookCover({ className, ...props }: CoverProps) {
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const theme = getCoverTheme(props.theme);
  return (
    <svg
      viewBox={`-4 -2 ${COVER_W + 14} ${COVER_H + 26}`}
      className={cn("block h-auto w-full drop-shadow-[0_14px_18px_rgba(40,25,10,0.35)]", className)}
      aria-hidden="true"
    >
      {/* Paper block behind the cover */}
      <g>
        <rect x="6" y="3" width={COVER_W} height={COVER_H} rx="8" fill={theme.shade} />
        <rect x="5" y="4" width={COVER_W - 1} height={COVER_H - 1} rx="7" fill={theme.paper} />
        {[1.6, 3.2, 4.8].map((d) => (
          <path
            key={d}
            d={`M${COVER_W - 10 + d} ${4 + d} V${COVER_H - 4 + d * 0.2}`}
            stroke="#8a6f4a"
            strokeOpacity="0.25"
            strokeWidth="0.5"
          />
        ))}
      </g>
      {/* Ribbon bookmark hanging out of the bottom */}
      <path
        d={`M${COVER_W - 60} ${COVER_H - 4} h7 v24 l-3.5 -4 l-3.5 4 Z`}
        fill={theme.ribbon}
        stroke="#000"
        strokeOpacity="0.2"
        strokeWidth="0.5"
      />
      <CoverArt {...props} uid={uid} />
    </svg>
  );
}
