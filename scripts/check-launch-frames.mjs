/*
 * Launch-frame classifier for the dark-flash bug.
 *
 * The reported symptom was a dark blink on a device in night mode, caused by the
 * native window background falling back to AppCompat's dark colorBackground
 * between the starting window and the WebView's first paint. So the thing to
 * watch for is not "is it branded" but "is any frame dark at all".
 *
 * Every frame is bucketed by mean luminance plus brand coverage:
 *   DARK    - mean luminance below a threshold, no brand  <- the bug
 *   BRANDED - TCS navy/red present (splash or app chrome)
 *   LIGHT   - bright and unbranded (plain white)
 *   APP     - bright with enough non-brand content to be real UI
 */
import sharp from "sharp";
import { readdirSync, mkdirSync, copyFileSync } from "node:fs";

const DIR = process.argv[2];
const OUT = process.argv[3] ?? DIR;
mkdirSync(OUT, { recursive: true });

const DARK_LUMA = 140; // mean 0-255 below this reads as a dark flash

const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".png"))
  .sort();

console.log(`frame      meanLuma  white%   navy+red   verdict`);
console.log("-".repeat(62));

let darkFrames = [];
const rows = [];

for (const f of files) {
  const { data, info } = await sharp(`${DIR}/${f}`)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const W = info.width,
    H = info.height,
    ch = info.channels;
  const total = W * H;

  let sum = 0;
  let white = 0;
  let brand = 0;
  let nonWhiteInk = 0;

  for (let i = 0; i < data.length; i += ch) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sum += luma;
    if (r > 236 && g > 236 && b > 236) white++;
    const isNavy = Math.abs(r - 0x28) < 45 && Math.abs(g - 0x24) < 45 && Math.abs(b - 0x6a) < 45;
    const isRed = Math.abs(r - 0xed) < 45 && Math.abs(g - 0x1c) < 45 && Math.abs(b - 0x23) < 45;
    if (isNavy || isRed) brand++;
    else if (luma < 220) nonWhiteInk++;
  }

  const luma = sum / total;
  const wp = (white / total) * 100;
  const bp = (brand / total) * 100;

  let verdict;
  if (luma < DARK_LUMA && bp < 0.5) {
    verdict = "DARK FLASH  <-- bug";
    darkFrames.push(f);
  } else if (bp > 0.5) {
    verdict = "branded (splash/app)";
  } else if (nonWhiteInk / total > 0.03) {
    verdict = "app content";
  } else {
    verdict = "plain light";
  }

  console.log(
    `${f.padEnd(11)}${luma.toFixed(0).padStart(6)}${wp.toFixed(1).padStart(9)}${bp.toFixed(2).padStart(10)}   ${verdict}`,
  );
  rows.push({ f, luma, wp, bp, verdict });
}

console.log(`\nframes captured : ${files.length}`);
console.log(`dark flash frames: ${darkFrames.length}`);
if (darkFrames.length) {
  console.log(`  -> ${darkFrames.join(", ")}`);
  console.log(`\nresult: FAIL - a dark frame is still on screen during launch`);
} else {
  const branded = rows.filter((r) => r.verdict.startsWith("branded"));
  console.log(`branded frames  : ${branded.length}`);
  console.log(`\nresult: PASS - no dark frame; launch goes straight to branded splash`);
  if (branded.length) {
    const pick = branded[Math.floor(branded.length / 2)];
    copyFileSync(`${DIR}/${pick.f}`, `${OUT}/../launch-branded.png`);
    console.log(`representative splash frame saved: launch-branded.png (${pick.f})`);
  }
}
