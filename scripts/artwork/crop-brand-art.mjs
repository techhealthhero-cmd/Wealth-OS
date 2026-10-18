// Cuts the five Brand & Marketing drawings out of their sheet
// (assets/artwork/drafts/brand-marketing-concept-v1-gouache-ink.png,
// 1024x1536: a 2x2 grid of near-square panels over one wide journey map)
// into rounded WebPs under public/artwork/brand/.
//
//   node scripts/artwork/crop-brand-art.mjs
//
// Boxes are [left, top, width, height] in sheet pixels, kept inside each
// panel's painted wash so no white paper shows at the rounded corners.
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const SHEET = "assets/artwork/drafts/brand-marketing-concept-v1-gouache-ink.png";
const OUT = "public/artwork/brand";

const CROPS = {
  planner: { box: [58, 92, 412, 412], size: [360, 360] }, // green planner + route: welcome / opening
  announcement: { box: [538, 92, 436, 436], size: [256, 256] }, // planner page, megaphone: what's new
  preview: { box: [44, 574, 448, 448], size: [256, 256] }, // phone, ledger, calculator: the product
  social: { box: [556, 584, 432, 432], size: [360, 360] }, // chart, shield, jar: link previews
  journey: { box: [40, 1084, 948, 380], size: [720, 289] }, // receipt -> calendar -> work -> home
};

mkdirSync(OUT, { recursive: true });
for (const [key, { box, size }] of Object.entries(CROPS)) {
  const [left, top, width, height] = box;
  const [w, h] = size;
  const radius = Math.round(Math.min(w, h) * 0.16);
  const mask = Buffer.from(
    `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`
  );
  const frame = await sharp(SHEET).extract({ left, top, width, height }).resize(w, h).png().toBuffer();
  const rounded = sharp(frame).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]);
  // The link-preview card (src/app/opengraph-image.tsx) is drawn by Satori,
  // which reads PNG but not WebP.
  const file = key === "social" ? `${OUT}/${key}.png` : `${OUT}/${key}.webp`;
  await (key === "social" ? rounded.png({ compressionLevel: 9 }) : rounded.webp({ quality: 82 })).toFile(file);
  console.log(file);
}
