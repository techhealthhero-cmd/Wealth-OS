// Cuts the five Earn & Skills drawings out of their sheet
// (assets/artwork/drafts/earn-skills-concept-v1-gouache-ink.png, 1254x1254,
// a 2x3 grid with the last cell empty) into rounded 3:2 WebPs under
// public/artwork/earn/.
//
//   node scripts/artwork/crop-earn-skills-art.mjs
//
// Boxes are [left, top] in sheet pixels; every box is BOX_W x BOX_H.
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const SHEET = "assets/artwork/drafts/earn-skills-concept-v1-gouache-ink.png";
const OUT = "public/artwork/earn";
const BOX_W = 585;
const BOX_H = 390;
const WIDTH = 360;
const HEIGHT = 240;

const BOXES = {
  freelance: [25, 24], // laptop portfolio, briefcase and client notes
  "online-selling": [644, 24], // storefront phone and packed order
  "skill-development": [25, 437], // learning cards progressing to a tick
  "first-extra-income": [644, 455], // completed work turning into the first saved coins
  "mission-completed": [25, 846], // checked list and route reaching its flag
};

const RADIUS = Math.round(HEIGHT * 0.16);
const mask = Buffer.from(
  `<svg width="${WIDTH}" height="${HEIGHT}"><rect width="${WIDTH}" height="${HEIGHT}" rx="${RADIUS}" ry="${RADIUS}" fill="#fff"/></svg>`
);

mkdirSync(OUT, { recursive: true });
for (const [key, [left, top]] of Object.entries(BOXES)) {
  const frame = await sharp(SHEET)
    .extract({ left, top, width: BOX_W, height: BOX_H })
    .resize(WIDTH, HEIGHT)
    .png()
    .toBuffer();
  await sharp(frame)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .webp({ quality: 82 })
    .toFile(`${OUT}/${key}.webp`);
  console.log(`${OUT}/${key}.webp`);
}
