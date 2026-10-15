// Cuts the four Track / Plan / Earn / Grow drawings out of the onboarding
// pillars sheet (assets/artwork/drafts/onboarding-pillars-concept-v2-gouache-ink.png,
// 1225x1284, a 2x2 grid) into one rounded square WebP each under
// public/artwork/pillars/.
//
//   node scripts/artwork/crop-pillar-art.mjs
//
// Boxes are [left, top, size] in sheet pixels, each a square around one
// coloured wash (green, yellow, red, blue).
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const SHEET = "assets/artwork/drafts/onboarding-pillars-concept-v2-gouache-ink.png";
const OUT = "public/artwork/pillars";
const SIZE = 256;

const BOXES = {
  track: [35, 50, 585], // notebook, receipt, calculator, magnifier
  plan: [625, 50, 585], // calendar, folded route map, flag, pencil
  earn: [25, 640, 585], // laptop of skills, briefcase, growth blocks, offer
  grow: [625, 640, 585], // savings jar, shield, home, stepping stones
};

const RADIUS = Math.round(SIZE * 0.24);
const mask = Buffer.from(
  `<svg width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" ry="${RADIUS}" fill="#fff"/></svg>`
);

mkdirSync(OUT, { recursive: true });
for (const [key, [left, top, size]] of Object.entries(BOXES)) {
  const square = await sharp(SHEET)
    .extract({ left, top, width: size, height: size })
    .resize(SIZE, SIZE)
    .png()
    .toBuffer();
  await sharp(square)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .webp({ quality: 82 })
    .toFile(`${OUT}/${key}.webp`);
  console.log(`${OUT}/${key}.webp`);
}
