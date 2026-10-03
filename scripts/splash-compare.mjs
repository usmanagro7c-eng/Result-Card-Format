import sharp from "sharp";
import { readFileSync } from "node:fs";

/*
 * Builds a before/after contact sheet at this device's real resolution so the
 * "oval" fix can be eyeballed, not just measured.
 *
 *   before - the @capacitor/assets splash: a 1280x1920 bitmap used directly as
 *            android:background, so Android stretches it to 1080x2220 and the
 *            crest comes out squashed.
 *   after  - the layer-list: white fill + lockup centred at 1:1.
 */
const OUT = "splash-preview.png";
const W = 1080;
const H = 2220;
const GAP = 40;
const LABEL_H = 96;

const logoBuf = readFileSync("public/TCS Logo.png");

/** Renders one line of text to a tight transparent PNG. */
async function label(text, size, color) {
  const cw = 2600;
  const ch = Math.round(size * 1.8);
  const probe = await sharp({
    create: { width: cw, height: ch, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}">
             <text x="16" y="${Math.round(size * 1.35)}" font-family="Segoe UI"
                   font-size="${size}" font-weight="700" fill="${color}">${text}</text>
           </svg>`,
        ),
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer();

  const { data, info } = await sharp(probe)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = info.width,
    maxX = -1,
    minY = info.height,
    maxY = -1;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  return sharp(probe)
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .png()
    .toBuffer();
}

async function oldWay() {
  // Logo laid out on the 1280x1920 bucket, then that bitmap stretched to fill.
  const bucket = await sharp({
    create: { width: 1280, height: 1920, channels: 4, background: "#FFFFFF" },
  })
    .composite([
      { input: await sharp(logoBuf).resize(800, 764).png().toBuffer(), left: 240, top: 578 },
    ])
    .png()
    .toBuffer();
  return sharp(bucket).resize(W, H, { fit: "fill" }).png().toBuffer();
}

async function newWay() {
  const lock = readFileSync("android/app/src/main/res/drawable-xxhdpi/splash_lockup.png");
  const m = await sharp(lock).metadata();
  return sharp({
    create: { width: W, height: H, channels: 4, background: "#FFFFFF" },
  })
    .composite([
      { input: lock, left: Math.round((W - m.width) / 2), top: Math.round((H - m.height) / 2) },
    ])
    .png()
    .toBuffer();
}

const before = await oldWay();
const after = await newWay();

const lBefore = await label("BEFORE  -  stretched bitmap, squashed (oval)", 40, "#FCA5A5");
const lAfter = await label("AFTER  -  centred in a layer-list, undistorted", 40, "#86EFAC");
const lBeforeM = await sharp(lBefore).metadata();
const lAfterM = await sharp(lAfter).metadata();

const sheetW = W * 2 + GAP * 3;
const sheetH = H + LABEL_H + GAP * 2;

const sheet = await sharp({
  create: { width: sheetW, height: sheetH, channels: 4, background: "#0F172A" },
})
  .composite([
    { input: before, left: GAP, top: LABEL_H + GAP },
    { input: after, left: GAP * 2 + W, top: LABEL_H + GAP },
    { input: lBefore, left: GAP, top: Math.round((LABEL_H - lBeforeM.height) / 2) },
    {
      input: lAfter,
      left: GAP * 2 + W,
      top: Math.round((LABEL_H - lAfterM.height) / 2),
    },
  ])
  .png()
  .toBuffer();

await sharp(sheet)
  .resize(Math.round(sheetW / 2))
  .png()
  .toFile(OUT);
console.log(`wrote ${OUT}   (left = before/oval, right = after/fixed)`);
console.log(`sheet ${sheetW}x${sheetH} -> ${Math.round(sheetW / 2)}px wide`);
