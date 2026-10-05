/*
 * Pins down the exact frame that causes the blink between the native starting
 * window and the web overlay.
 *
 * Three visual stages are in play during launch:
 *   1. native starting window  - white + TCS lockup (from android:windowBackground)
 *   2. whatever the window shows in the gap before the page paints
 *   3. the web #boot overlay    - white + lockup + loading bar
 *
 * So the interesting buckets are:
 *   LOGO+BAR  stage 3 (lockup plus the navy bar band low on the screen)
 *   LOGO      stage 1 (lockup, no bar)
 *   BLANK     bright, no lockup at all  <- this is the blink
 *   DARK      dark frame
 */
import sharp from "sharp";
import { readdirSync, mkdirSync, copyFileSync } from "node:fs";

const DIR = process.argv[2];
const OUT = process.argv[3] ?? DIR;
mkdirSync(OUT, { recursive: true });

const isNavy = (r, g, b) =>
  Math.abs(r - 0x28) < 45 && Math.abs(g - 0x24) < 45 && Math.abs(b - 0x6a) < 45;
const isRed = (r, g, b) =>
  Math.abs(r - 0xed) < 45 && Math.abs(g - 0x1c) < 45 && Math.abs(b - 0x23) < 45;

console.log("frame      luma  white%  brand%  logoBbox        bar?  stage");
console.log("-".repeat(74));

const rows = [];
for (const f of readdirSync(DIR)
  .filter((x) => x.endsWith(".png"))
  .sort()) {
  const { data, info } = await sharp(`${DIR}/${f}`)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width,
    H = info.height,
    ch = info.channels;
  const total = W * H;

  let sum = 0,
    white = 0,
    brand = 0;
  let minX = W,
    maxX = -1,
    minY = H,
    maxY = -1;
  const rowBrand = new Array(H).fill(0);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (r > 236 && g > 236 && b > 236) white++;
      if (isNavy(r, g, b) || isRed(r, g, b)) {
        brand++;
        rowBrand[y]++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const luma = sum / total;
  const wp = (white / total) * 100;
  const bp = (brand / total) * 100;

  // A bar band is a short run of brand rows in the lower third of the screen.
  const barRows = [];
  let s = -1;
  for (let y = Math.floor(H * 0.6); y < H; y++) {
    if (rowBrand[y] > 0 && s < 0) s = y;
    if (rowBrand[y] === 0 && s >= 0) {
      barRows.push([s, y - 1]);
      s = -1;
    }
  }
  const barBand = barRows.find((b) => b[1] - b[0] <= 14);

  const bbox = maxX < 0 ? "none" : `${maxX - minX + 1}x${maxY - minY + 1}`;
  let stage;
  if (luma < 140) stage = "DARK (launcher/flash)";
  else if (barBand) stage = "LOGO + BAR  (web overlay)";
  else if (brand / total > 0.004) stage = "LOGO only   (native splash)";
  else if (wp > 85) stage = "BLANK white  <-- BLINK";
  else stage = "app content";

  console.log(
    `${f.padEnd(11)}${luma.toFixed(0).padStart(4)}${wp.toFixed(1).padStart(8)}${bp.toFixed(2).padStart(8)}  ${bbox.padEnd(16)}${barBand ? "yes" : "no "}   ${stage}`,
  );
  rows.push({ f, stage });
}

const blink = rows.filter((r) => r.stage.startsWith("BLANK"));
const dark = rows.filter((r) => r.stage.startsWith("DARK"));
const native = rows.filter((r) => r.stage.startsWith("LOGO only"));
const overlay = rows.filter((r) => r.stage.startsWith("LOGO + BAR"));

console.log(`\nnative-logo-only frames : ${native.length}`);
console.log(`web-overlay frames      : ${overlay.length}`);
console.log(`blank-white frames      : ${blink.length}${blink.length ? "  <-- the blink" : ""}`);
console.log(`dark frames             : ${dark.length}`);

const distinct = [...new Set(rows.map((r) => r.stage))];
console.log(`\nstages seen: ${distinct.join("  |  ")}`);
console.log(
  blink.length
    ? "\nresult: a blank white frame sits between the native splash and the overlay"
    : "\nresult: no blank frame - native splash and overlay are adjacent",
);

if (blink.length)
  (copyFileSync(`${DIR}/${blink[0].f}`, `${OUT}/../blink-frame.png`),
    console.log(`blink frame saved: blink-frame.png (${blink[0].f})`));
