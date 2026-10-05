/*
 * Walks every extracted video frame and labels the launch stages, so the exact
 * sequence and the duration of each stage is known.
 *
 * Stages are identified from the shape of the brand-pixel row profile rather than
 * from a single statistic, because the running app also has navy pixels (bottom
 * nav, header) and a naive "is there a thin navy band" test mislabels the app as
 * the splash.
 *
 *   splash  - one dominant centred block (the lockup crest) plus a thin bar low
 *             on the screen, with little else
 *   app     - brand pixels spread across several bands, or a band hugging the
 *             bottom edge at nav height
 *   dark    - the launcher
 *   flash   - anything bright and empty, or a sudden luma jump between neighbours
 */
import sharp from "sharp";
import { readdirSync } from "node:fs";

const DIR = process.argv[2];
const STEP = Number(process.argv[3] ?? 1);

const isNavy = (r, g, b) =>
  Math.abs(r - 0x28) < 45 && Math.abs(g - 0x24) < 45 && Math.abs(b - 0x6a) < 45;
const isRed = (r, g, b) =>
  Math.abs(r - 0xed) < 45 && Math.abs(g - 0x1c) < 45 && Math.abs(b - 0x23) < 45;

const files = readdirSync(DIR)
  .filter((f) => /^f_\d+\.png$/.test(f))
  .sort();

const stats = [];
for (const f of files) {
  const { data, info } = await sharp(`${DIR}/${f}`)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width,
    H = info.height,
    ch = info.channels;
  let sum = 0,
    brand = 0,
    white = 0;
  const rows = new Array(H).fill(0);
  let minX = W,
    maxX = -1,
    minY = H,
    maxY = -1;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (r > 236 && g > 236 && b > 236) white++;
      const hit = isNavy(r, g, b) || isRed(r, g, b);
      if (hit) {
        brand++;
        rows[y]++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const gapTol = Math.round(H * 0.006);
  const groups = [];
  let s = -1;
  for (let y = 0; y < H; y++) {
    if (rows[y] > 0 && s < 0) s = y;
    if (rows[y] === 0 && s >= 0) {
      groups.push([s, y - 1]);
      s = -1;
    }
  }
  if (s >= 0) groups.push([s, H - 1]);
  const merged = [];
  for (const g of groups) {
    if (merged.length && g[0] - merged[merged.length - 1][1] <= gapTol)
      merged[merged.length - 1][1] = g[1];
    else merged.push([...g]);
  }
  const solid = merged.filter(([a, b]) => b - a >= 3);

  const tallest = solid.reduce((m, b) => (b[1] - b[0] > (m ? m[1] - m[0] : -1) ? b : m), null);
  const tallestMid = tallest ? (tallest[0] + tallest[1]) / 2 / H : 0;
  const tallestFrac = tallest ? (tallest[1] - tallest[0] + 1) / H : 0;

  // a thin band hard against the bottom edge is the bottom nav / loading bar
  const bottomBand = solid.find(([a, b]) => b > H * 0.9 && b - a <= H * 0.07);
  const hasBottomBar = !!bottomBand;

  stats.push({
    f,
    H,
    luma: sum / (W * H),
    white: (white / (W * H)) * 100,
    brand: (brand / (W * H)) * 100,
    bbox: maxX < 0 ? 0 : (maxX - minX + 1) * (maxY - minY + 1),
    bboxW: maxX < 0 ? 0 : maxX - minX + 1,
    bboxH: maxY < 0 ? 0 : maxY - minY + 1,
    bands: solid.length,
    tallestFrac,
    tallestMid,
    hasBottomBar,
  });
}

// ---- label ----
// splash: one dominant centred block (the crest) and little else
// app:    brand pixels spread over several bands, or a tall bbox
for (const s of stats) {
  if (s.luma < 120) s.stage = "launcher/dark";
  else if (
    s.bands <= 4 &&
    s.tallestFrac > 0.1 &&
    s.tallestFrac < 0.45 &&
    s.tallestMid > 0.28 &&
    s.tallestMid < 0.72
  )
    s.stage = "SPLASH";
  else if (s.bands >= 5 || s.bboxH > s.H * 0.8) s.stage = "app";
  else s.stage = "other";
}

// ---- run-length the sequence ----
const seq = [];
for (const s of stats) {
  const last = seq[seq.length - 1];
  if (last && last.stage === s.stage) {
    last.end = s.f;
    last.count++;
    last.lastLuma = s.luma;
    last.lastBrand = s.brand;
  } else {
    seq.push({
      stage: s.stage,
      start: s.f,
      end: s.f,
      count: 1,
      firstLuma: s.luma,
      firstBrand: s.brand,
      lastLuma: s.luma,
      lastBrand: s.brand,
    });
  }
}

const fps = 60;
console.log("stage sequence (60fps, ~16.7ms per frame):\n");
console.log(
  "stage".padEnd(16) +
    "frames".padEnd(9) +
    "~ms".padEnd(8) +
    "from      to        luma      brand%",
);
console.log("-".repeat(84));
for (const r of seq) {
  const startIdx = parseInt(r.start.slice(2), 10);
  const ms = ((r.count - 1) * 1000) / fps;
  console.log(
    `${r.stage.padEnd(16)}${String(r.count).padEnd(9)}${ms.toFixed(0).padStart(6)}   ${r.start.padEnd(9)}${r.end.padEnd(9)}${(r.lastLuma ?? 0).toFixed(0).padStart(4)}    ${(r.lastBrand ?? 0).toFixed(2).padStart(6)}`,
  );
}

// ---- report anything that looks like a flash ----
console.log("\ntransitions:");
for (let i = 1; i < stats.length; i++) {
  const a = stats[i - 1],
    b = stats[i];
  const dL = Math.abs(a.luma - b.luma);
  const dB = Math.abs(a.brand - b.brand);
  const dW = Math.abs(a.white - b.white);
  if (dL > 45 || dB > 0.6 || dW > 25) {
    console.log(
      `  ${a.f} -> ${b.f}  luma ${a.luma.toFixed(0)}->${b.luma.toFixed(0)} (d${dL.toFixed(0)})  ` +
        `white ${a.white.toFixed(0)}->${b.white.toFixed(0)} (d${dW.toFixed(0)})  brand ${a.brand.toFixed(2)}->${b.brand.toFixed(2)} (d${dB.toFixed(2)})`,
    );
  }
}

// detail dump around every stage change
console.log("\nper-frame detail at each boundary:");
for (const r of seq.slice(0, 12)) {
  console.log(`  -- ${r.stage} --`);
  const idx = stats.findIndex((s) => s.f === r.start);
  for (let k = Math.max(0, idx - 1); k <= Math.min(stats.length - 1, idx + 2); k++) {
    const s = stats[k];
    console.log(
      `     ${s.f}  luma ${s.luma.toFixed(0).padStart(4)}  white ${s.white.toFixed(0).padStart(4)}%  brand ${s.brand.toFixed(2).padStart(5)}%  bands ${String(s.bands).padStart(2)}  bbox ${s.bboxW}x${s.bboxH}  ${s.stage}`,
    );
  }
}
