// Cuts the 11 expense-category drawings out of the approved sheet
// (assets/artwork/drafts/expense-category-art-mockup-v8-gouache-ink.png,
// 1024x1536) into one square WebP each under public/artwork/categories/,
// named by the `categories.icon` key they stand for.
//
//   node scripts/artwork/crop-category-art.mjs
//
// Boxes are [left, top, size] in sheet pixels, each a square around one drawing.
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const SHEET = "assets/artwork/drafts/expense-category-art-mockup-v8-gouache-ink.png";
const OUT = "public/artwork/categories";
const SIZE = 192;

const BOXES = {
  "shopping-bag": [95, 172, 262], // 01
  "heart-pulse": [390, 175, 262], // 02
  film: [692, 165, 285], // 03
  "graduation-cap": [92, 482, 272], // 04
  "plug-zap": [402, 484, 254], // 05
  repeat: [708, 480, 266], // 06
  shield: [110, 766, 254], // 07
  users: [388, 774, 272], // 08
  gift: [714, 764, 276], // 09
  tools: [232, 1062, 250], // 10
  "more-horizontal": [572, 1052, 245], // 11
};

// Rounded corners (transparent) hide the sheet's tile numbers and ruling
// that sit in the corners of some boxes, and read as a paper sticker.
const RADIUS = Math.round(SIZE * 0.24);
const mask = Buffer.from(
  `<svg width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" ry="${RADIUS}" fill="#fff"/></svg>`
);

mkdirSync(OUT, { recursive: true });
for (const [key, [left, top, size]] of Object.entries(BOXES)) {
  const square = await sharp(SHEET).extract({ left, top, width: size, height: size }).resize(SIZE, SIZE).png().toBuffer();
  await sharp(square)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .webp({ quality: 82 })
    .toFile(`${OUT}/${key}.webp`);
  console.log(`${OUT}/${key}.webp`);
}
