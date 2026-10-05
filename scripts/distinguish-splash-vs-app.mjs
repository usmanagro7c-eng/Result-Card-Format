/*
 * Decides whether a frame is the launch splash or the running app.
 *
 * The earlier classifier keyed on "is there a thin navy band low on the screen",
 * which is true of both: the splash has its loading bar and the app has a bottom
 * navigation bar. It also reported a logo bbox that spanned the whole screen,
 * which is the app, not a centred 350x334 crest.
 *
 * The reliable discriminator is the shape of the brand-pixel row profile:
 *   splash - one compact centred block plus one thin bar, with large empty gaps
 *   app    - brand pixels scattered down the page in many bands
 */
import sharp from "sharp";
import { readdirSync } from "node:fs";

const DIR = process.argv[2];

const isNavy = (r, g, b) =>
  Math.abs(r - 0x28) < 45 && Math.abs(g - 0x24) < 45 && Math.abs(b - 0x6a) < 45;
const isRed = (r, g, b) =>
  Math.abs(r - 0xed) < 45 && Math.abs(g - 0x1c) < 45 && Math.abs(b - 0x23) < 45;

function profile(file) {
  return sharp(file)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => {
      const W = info.width,
        H = info.height,
        ch = info.channels;
      const rows = new Array(H).fill(0);
      for (let y = 0; y < H; y++) {
        let n = 0;
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * ch;
          if (isNavy(data[i], data[i + 1], data[i + 2]) || isRed(data[i], data[i + 1], data[i + 2]))
            n++;
        }
        rows[y] = n;
      }

      // contiguous groups of rows containing brand pixels
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

      // merge across small gaps (letter spacing inside the wordmark)
      const gapTol = Math.round(H * 0.006);
      const merged = [];
      for (const g of groups) {
        if (merged.length && g[0] - merged[merged.length - 1][1] <= gapTol)
          merged[merged.length - 1][1] = g[1];
        else merged.push([...g]);
      }

      // ignore hairline rows
      const solid = merged.filter(([a, b]) => b - a >= 3);

      return {
        W,
        H,
        bands: solid.map(([a, b]) => ({
          y: [a, b],
          h: b - a + 1,
          peak: Math.max(...rows.slice(a, b + 1)),
        })),
      };
    });
}

console.log("frame     bands  tallestBand  tallestAt%  verdict");
console.log("-".repeat(64));

const seen = new Map();
for (const f of readdirSync(DIR)
  .filter((x) => x.endsWith(".png"))
  .sort()) {
  const p = await profile(`${DIR}/${f}`);
  const tallest = p.bands.reduce((m, b) => (b.h > (m?.h ?? 0) ? b : m), null);
  const at = tallest ? ((tallest.y[0] + tallest.y[1]) / 2 / p.H) * 100 : 0;

  // A splash crest is a single dominant block roughly 15-30% of screen height,
  // centred, plus at most a thin bar. The app has many bands and no single huge one.
  const tallFrac = tallest ? tallest.h / p.H : 0;
  const isSplash = p.bands.length <= 4 && tallFrac > 0.12 && tallFrac < 0.45 && at > 30 && at < 70;

  const verdict = isSplash ? "SPLASH (crest + bar)" : "APP / other";
  const key = verdict + "|" + p.bands.length;
  if (!seen.has(key)) seen.set(key, f);

  console.log(
    `${f.padEnd(10)}${String(p.bands.length).padStart(4)}  ${String(tallest?.h ?? "-").padStart(10)}  ${(tallest ? at.toFixed(0) : "-").padStart(10)}%  ${verdict}`,
  );
}

console.log("\nverdict counts:");
for (const [key, f] of seen) console.log(`  ${key.padEnd(22)} first seen: ${f}`);
