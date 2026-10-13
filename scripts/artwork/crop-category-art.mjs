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

// The supplement sheet (2026-10-14): food, transport, housing and the income
// categories, 2 columns × 5 rows, no tile numbers. Its drawings are wider
// than tall, so each box is [left, top, width, height] and the cut is
// centred on a square of the sheet's own paper colour.
const SUPPLEMENT = "assets/artwork/drafts/expense-category-art-supplement-v1-gouache-ink.png";
const SUPPLEMENT_BOXES = {
  utensils: [150, 40, 380, 280],
  car: [545, 40, 400, 280],
  home: [130, 320, 390, 285],
  wallet: [545, 320, 400, 285],
  laptop: [115, 605, 400, 285],
  briefcase: [545, 605, 400, 285],
  percent: [120, 890, 395, 280],
  landmark: [545, 890, 400, 280],
  "rotate-ccw": [130, 1170, 385, 290],
  "gift-received": [545, 1170, 400, 290],
};

async function sticker(source, key, extract, background) {
  const square = await sharp(source)
    .extract(extract)
    .resize(SIZE, SIZE, { fit: "contain", background })
    .png()
    .toBuffer();
  await sharp(square)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .webp({ quality: 82 })
    .toFile(`${OUT}/${key}.webp`);
  console.log(`${OUT}/${key}.webp`);
}

mkdirSync(OUT, { recursive: true });
for (const [key, [left, top, size]] of Object.entries(BOXES)) {
  await sticker(SHEET, key, { left, top, width: size, height: size }, "#ffffff");
}
for (const [key, [left, top, width, height]] of Object.entries(SUPPLEMENT_BOXES)) {
  // Paper colour: the brightest corner patch of this cut (the drawings'
  // colour washes reach some edges, the bare paper is the lightest).
  const corners = [
    [left, top],
    [left + width - 12, top],
    [left, top + height - 12],
    [left + width - 12, top + height - 12],
  ];
  let paper = { r: 0, g: 0, b: 0, alpha: 1 };
  for (const [x, y] of corners) {
    // stats() reads the whole input, ignoring extract — so average the raw patch.
    const { data, info } = await sharp(SUPPLEMENT)
      .extract({ left: x, top: y, width: 12, height: 12 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const sum = [0, 0, 0];
    for (let i = 0; i < data.length; i += info.channels) for (let k = 0; k < 3; k++) sum[k] += data[i + k];
    const n = data.length / info.channels;
    const c = { r: Math.round(sum[0] / n), g: Math.round(sum[1] / n), b: Math.round(sum[2] / n), alpha: 1 };
    if (c.r + c.g + c.b > paper.r + paper.g + paper.b) paper = c;
  }
  await sticker(SUPPLEMENT, key, { left, top, width, height }, paper);
}
