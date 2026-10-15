// Cuts the five Net Worth & Financial Foundation drawings out of their sheet
// (assets/artwork/drafts/net-worth-financial-foundation-concept-v1-gouache-ink.png,
// 1254x1254, 2 columns x 3 rows) into one rounded 3:2 WebP each under
// public/artwork/net-worth/.
//
//   node scripts/artwork/crop-net-worth-art.mjs
//
// Boxes are [left, top] in sheet pixels; every box is BOX_W x BOX_H, around
// one coloured wash. The drawings are wider than tall, so they keep a 3:2
// frame instead of the square stickers the categories use.
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const SHEET = "assets/artwork/drafts/net-worth-financial-foundation-concept-v1-gouache-ink.png";
const OUT = "public/artwork/net-worth";
const BOX_W = 570;
const BOX_H = 380;
const W = 360;
const H = 240;

const BOXES = {
  balance: [35, 30], // scale: home, savings, chart vs. bills and a stone
  assets: [645, 28], // open box: key, card, coins, chart
  liabilities: [35, 440], // clipboard checklist, stepping blocks, pencil
  "no-history": [640, 440], // empty ruled notebook, magnifier, pencil
  "emergency-fund": [35, 825], // shield, savings jar, home
};

const RADIUS = Math.round(H * 0.18);
const mask = Buffer.from(
  `<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="${RADIUS}" ry="${RADIUS}" fill="#fff"/></svg>`
);

mkdirSync(OUT, { recursive: true });
for (const [key, [left, top]] of Object.entries(BOXES)) {
  const frame = await sharp(SHEET)
    .extract({ left, top, width: BOX_W, height: BOX_H })
    .resize(W, H)
    .png()
    .toBuffer();
  await sharp(frame)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .webp({ quality: 82 })
    .toFile(`${OUT}/${key}.webp`);
  console.log(`${OUT}/${key}.webp`);
}
