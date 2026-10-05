/*
 * Renders the native launch window exactly as Android would compose it, then
 * diffs it against a real screenshot of the web #boot overlay.
 *
 * The reported bug was two visibly different splashes: the native one showed a
 * bare lockup, then the web overlay appeared with a loading bar, with a blink in
 * between. That is only fixed if the native composition now *includes* the bar and
 * puts everything in the same place, and the only way to be sure without catching
 * a sub-200ms frame on camera is to compose the layer-list by hand and compare.
 *
 * Android draws splash_window.xml as:
 *   white fill -> lockup centred -> bar at bottom, 84dp up, 240dp x 4dp
 * with the xxhdpi lockup scaled by deviceDensity / bucketDpi.
 */
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const DEVICE_W = 1080;
const DEVICE_H = 2220;
const DENSITY = 420; // this device
const BUCKET_DPI = 480; // xxhdpi
const DPR = DENSITY / 160;

const LOCKUP = "android/app/src/main/res/drawable-xxhdpi/splash_lockup.png";

/** band stats for a horizontal strip, to compare lockup and bar independently */
async function bands(file) {
  const { data, info } = await sharp(file)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width,
    H = info.height,
    ch = info.channels;
  const isNavy = (r, g, b) =>
    Math.abs(r - 0x28) < 45 && Math.abs(g - 0x24) < 45 && Math.abs(b - 0x6a) < 45;
  const isRed = (r, g, b) =>
    Math.abs(r - 0xed) < 45 && Math.abs(g - 0x1c) < 45 && Math.abs(b - 0x23) < 45;

  const rows = [];
  for (let y = 0; y < H; y++) {
    let brand = 0,
      minX = W,
      maxX = -1;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch;
      if (isNavy(data[i], data[i + 1], data[i + 2]) || isRed(data[i], data[i + 1], data[i + 2])) {
        brand++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
    rows.push({ y, brand, minX, maxX });
  }

  // group contiguous rows with brand pixels
  const groups = [];
  let start = -1;
  for (let y = 0; y < H; y++) {
    if (rows[y].brand > 0 && start < 0) start = y;
    if (rows[y].brand === 0 && start >= 0) {
      groups.push([start, y - 1]);
      start = -1;
    }
  }
  if (start >= 0) groups.push([start, H - 1]);

  // merge across small gaps (spacing inside the wordmark)
  const merged = [];
  for (const g of groups) {
    if (merged.length && g[0] - merged[merged.length - 1][1] < Math.round(14 * DPR)) {
      merged[merged.length - 1][1] = g[1];
    } else merged.push([...g]);
  }

  const describe = ([a, b]) => {
    let minX = W,
      maxX = -1;
    for (let y = a; y <= b; y++) {
      if (rows[y].brand > 0) {
        if (rows[y].minX < minX) minX = rows[y].minX;
        if (rows[y].maxX > maxX) maxX = rows[y].maxX;
      }
    }
    return {
      y: [a, b],
      h: b - a + 1,
      w: maxX - minX + 1,
      fromBottom: Math.round(((H - b) / DPR) * 10) / 10,
    };
  };

  return { W, H, groups: merged.map(describe) };
}

const out = process.argv[2];
if (!out) {
  console.error("usage: node render-native-splash.mjs <web-overlay-screenshot.png>");
  process.exit(1);
}

// ---- compose the native launch window ----
const meta = await sharp(LOCKUP).metadata();
const scale = DENSITY / BUCKET_DPI;
const lw = Math.round(meta.width * scale);
const lh = Math.round(meta.height * scale);

const barW = Math.round(240 * DPR);
const barH = Math.round(4 * DPR);
const barBottom = Math.round(84 * DPR);
const segW = Math.round(108 * DPR); // the parked navy segment from splash_bar.xml

const track = await sharp({
  create: {
    width: barW,
    height: barH,
    channels: 4,
    background: { r: 0xe2, g: 0xe8, b: 0xf0, alpha: 1 },
  },
})
  .composite([
    {
      input: await sharp({
        create: {
          width: barW - segW,
          height: barH,
          channels: 4,
          background: { r: 0xf1, g: 0xf5, b: 0xf9, alpha: 1 },
        },
      })
        .png()
        .toBuffer(),
      left: segW,
      top: 0,
    },
    {
      input: await sharp({
        create: {
          width: segW,
          height: barH,
          channels: 4,
          background: { r: 0x28, g: 0x24, b: 0x6a, alpha: 1 },
        },
      })
        .png()
        .toBuffer(),
      left: 0,
      top: 0,
    },
  ])
  .png()
  .toBuffer();

// Android scales the density-bucket lockup by deviceDensity / bucketDpi before
// drawing it, so resize first - compositing the raw PNG would draw it at its
// natural size and make the comparison meaningless.
const lockupScaled = await sharp(LOCKUP).resize(lw, lh, { fit: "fill" }).png().toBuffer();

const nativeBuf = await sharp({
  create: { width: DEVICE_W, height: DEVICE_H, channels: 4, background: "#ffffff" },
})
  .composite([
    {
      input: lockupScaled,
      left: Math.round((DEVICE_W - lw) / 2),
      top: Math.round((DEVICE_H - lh) / 2),
    },
    {
      input: track,
      left: Math.round((DEVICE_W - barW) / 2),
      top: DEVICE_H - barBottom - barH,
    },
  ])
  .png()
  .toBuffer();

const nativeFile = "C:/Users/MAAN/AppData/Local/Temp/opencode/native-splash-render.png";
await sharp(nativeBuf).toFile(nativeFile);

console.log(`composed native launch window: ${DEVICE_W}x${DEVICE_H}`);
console.log(`  lockup ${lw}x${lh} centred  (${((lw / DEVICE_W) * 100).toFixed(1)}% of width)`);
console.log(`  bar    ${barW}x${barH} at ${barBottom}px (84dp) from bottom\n`);

const nb = await bands(nativeFile);
const wb = await bands(out);

console.log("native bands (y range, size, from-bottom dp):");
nb.groups.forEach((g) => console.log(`   y${g.y[0]}-${g.y[1]}  ${g.w}x${g.h}  ${g.fromBottom}dp`));
console.log("\nweb overlay bands:");
wb.groups.forEach((g) => console.log(`   y${g.y[0]}-${g.y[1]}  ${g.w}x${g.h}  ${g.fromBottom}dp`));

const nativeBar = nb.groups[nb.groups.length - 1];
const webBar = wb.groups[wb.groups.length - 1];
const nativeLock = nb.groups[0];
const webLock = wb.groups[0];

console.log("\ncomparison:");
const checks = [
  ["both have a bar band", !!nativeBar && !!webBar && nativeBar.h < 24 && webBar.h < 24],
  ["bar width matches", Math.abs(nativeBar.w - webBar.w) <= Math.max(12, webBar.w * 0.12)],
  ["bar height matches", Math.abs(nativeBar.h - webBar.h) <= 2],
  ["bar distance from bottom matches", Math.abs(nativeBar.fromBottom - webBar.fromBottom) <= 4],
  ["lockup width matches", Math.abs(nativeLock.w - webLock.w) <= Math.max(12, webLock.w * 0.06)],
  ["lockup height matches", Math.abs(nativeLock.h - webLock.h) <= Math.max(12, webLock.h * 0.06)],
];

let ok = true;
for (const [label, pass] of checks) {
  if (!pass) ok = false;
  console.log(`  ${pass ? "OK  " : "FAIL"}  ${label}`);
}

console.log(
  `\nresult: ${ok ? "native launch window now shows the same logo + loading bar as the web overlay" : "native and web still differ"}`,
);
console.log(`native render saved: ${nativeFile}`);
