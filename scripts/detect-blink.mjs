/*
 * Blink detector.
 *
 * Scans every extracted frame for a flash: any frame whose mean luminance is far
 * from both its neighbours, or any dark frame sitting between the splash and the
 * app. The bug this exists for was a 233ms PURE BLACK window in the middle of the
 * launch (rgb(0,0,0) over 95% of the frame), caused by the starting window's exit
 * animation fading over an Activity window whose decor background was @null.
 *
 * Usage: node detect-blink.mjs <frameDir>
 */
import sharp from "sharp";
import { readdirSync } from "node:fs";

const DIR = process.argv[2];
const files = readdirSync(DIR)
  .filter((f) => /^f_\d+\.png$/.test(f))
  .sort();

const frames = [];
for (const f of files) {
  const st = await sharp(`${DIR}/${f}`).stats();
  frames.push({
    f,
    luma:
      st.channels[0].mean * 0.2126 + st.channels[1].mean * 0.7152 + st.channels[2].mean * 0.0722,
  });
}

// locate the launch window: first bright frame .. last frame
const firstBright = frames.findIndex((x) => x.luma > 200);
const lastIdx = frames.length - 1;

console.log(`frames: ${frames.length}`);
console.log(
  `launch (first bright frame): ${frames[firstBright]?.f}  luma ${frames[firstBright]?.luma.toFixed(0)}`,
);
console.log(`final frame: ${frames[lastIdx].f}  luma ${frames[lastIdx].luma.toFixed(0)}`);

// 1. dark frames anywhere in the launch
const DARK = 170;
const darks = frames.slice(firstBright).filter((x) => x.luma < DARK);
console.log(`\nframes darker than luma ${DARK} after launch began: ${darks.length}`);
if (darks.length) {
  console.log(`  ${darks.map((d) => `${d.f}(${d.luma.toFixed(0)})`).join(", ")}`);
}

// 2. sharp frame-to-frame luminance jumps (a flash is a jump and a recovery)
console.log("\nsharp luminance jumps (>60 between adjacent frames):");
let jumps = 0;
for (let i = 1; i < frames.length; i++) {
  const d = Math.abs(frames[i].luma - frames[i - 1].luma);
  if (d > 60) {
    jumps++;
    console.log(
      `  ${frames[i - 1].f} -> ${frames[i].f}   ${frames[i - 1].luma.toFixed(0)} -> ${frames[i].luma.toFixed(0)}  (d${d.toFixed(0)})`,
    );
  }
}
if (!jumps) console.log("  none");

// 3. sustained runs of dark frames (a flash lasts longer than one frame)
console.log("\nsustained dark runs (>=3 consecutive frames):");
let run = [];
const runs = [];
for (let i = firstBright; i <= lastIdx; i++) {
  if (frames[i].luma < DARK) run.push(frames[i]);
  else {
    if (run.length >= 3) runs.push(run);
    run = [];
  }
}
if (run.length >= 3) runs.push(run);
if (runs.length) {
  for (const r of runs)
    console.log(
      `  ${r[0].f} .. ${r[r.length - 1].f}  (${r.length} frames, ${((r.length * 1000) / 60).toFixed(0)}ms, min luma ${Math.min(...r.map((x) => x.luma)).toFixed(0)})`,
    );
} else {
  console.log("  none");
}

console.log(
  `\nresult: ${darks.length === 0 && runs.length === 0 ? "no dark flash in the launch" : "DARK FLASH PRESENT"}`,
);
