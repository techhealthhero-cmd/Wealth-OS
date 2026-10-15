// Cuts the seven milestone drawings out of their sheet
// (assets/artwork/drafts/milestones-celebrations-concept-v1-gouache-ink.png,
// 1254x1254, a 3x3 grid with the last two cells empty) into one rounded
// square WebP each under public/artwork/milestones/.
//
//   node scripts/artwork/crop-milestone-art.mjs
//
// Boxes are [left, top] in sheet pixels; every box is BOX x BOX.
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const SHEET = "assets/artwork/drafts/milestones-celebrations-concept-v1-gouache-ink.png";
const OUT = "public/artwork/milestones";
const BOX = 385;
const SIZE = 256;

const BOXES = {
  "first-transaction": [28, 28], // notebook, first line ticked
  "first-budget": [435, 28], // calendar, envelopes, one ticked
  "emergency-fund-started": [842, 28], // jar with first coins, shield
  "goal-reached": [28, 428], // map, flag on the hill ticked
  "first-debt-paid": [435, 428], // clipboard, first item ticked, blocks
  "first-side-income": [842, 428], // briefcase, laptop, offer ticked
  "saving-streak-7": [28, 828], // 7 ticked days, coin jar
};

const RADIUS = Math.round(SIZE * 0.2);
const mask = Buffer.from(
  `<svg width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" ry="${RADIUS}" fill="#fff"/></svg>`
);

mkdirSync(OUT, { recursive: true });
for (const [key, [left, top]] of Object.entries(BOXES)) {
  const square = await sharp(SHEET)
    .extract({ left, top, width: BOX, height: BOX })
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
