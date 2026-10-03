import sharp from "sharp";
import { mkdirSync } from "node:fs";

/*
 * Regenerates the brand source art in `assets/` and installs the Android
 * splash lockup into res/.
 *
 *   node scripts/generate-brand-assets.mjs
 *
 * Run this after changing public/TCS Logo.png, then `npm run assets:android`
 * to refresh the launcher icons.
 */
const LOGO = "public/TCS Logo.png";
const OUT = "assets";
const RES = "android/app/src/main/res";

const WHITE = "#FFFFFF";
const NAVY = "#28246A";
const SCHOOL_NAME = "The Country School";
const FONT = "Segoe UI";

mkdirSync(OUT, { recursive: true });

const meta = await sharp(LOGO).metadata();
const aspect = meta.width / meta.height;
console.log(`logo: ${LOGO} ${meta.width}x${meta.height} (aspect ${aspect.toFixed(3)})\n`);

/** Composite `layers` onto a square canvas of `size`. */
async function canvas(size, bg, layers) {
  return sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite(layers)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Tight bounding box of pixels that are not fully transparent. */
async function inkBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width,
    maxX = -1,
    minY = info.height,
    maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Renders SCHOOL_NAME to a transparent PNG, auto-sized to the glyph run. */
async function renderWordmark(fontSize, weight = 700) {
  // The probe canvas has to be at least as large as the SVG overlay, otherwise
  // sharp refuses the composite.
  const probeW = 3000;
  const probeH = 420;
  const probe = await sharp({
    create: {
      width: probeW,
      height: probeH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${probeW}" height="${probeH}">
             <text x="20" y="${Math.round(fontSize * 1.25)}"
                   font-family="${FONT}" font-size="${fontSize}" font-weight="${weight}"
                   fill="${NAVY}" xml:space="preserve">${SCHOOL_NAME}</text>
           </svg>`,
        ),
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer();

  const box = await inkBox(probe);
  const text = await sharp(probe)
    .extract({ left: box.minX, top: box.minY, width: box.w, height: box.h })
    .png()
    .toBuffer();
  return { buf: text, w: box.w, h: box.h };
}

/*
 * Icons.
 *
 * icon-only.png       1024x1024 legacy launcher icon, composited as-is; logo at
 *                     ~78% width so pre-API-26 squircle/circle masks keep it whole.
 * icon-foreground.png 1024x1024 adaptive foreground; only the central 66.6% is
 *                     guaranteed visible, so the logo stays at ~59% width.
 * icon-background.png 1024x1024 flat white, matching values/ic_launcher_background.xml.
 */
console.log("icons:");
await (async () => {
  const logoLayer = async (w) => ({
    input: await sharp(LOGO)
      .resize(w, Math.round(w / aspect), { fit: "fill" })
      .png()
      .toBuffer(),
    left: Math.round((1024 - w) / 2),
    top: Math.round((1024 - Math.round(w / aspect)) / 2),
  });

  const only = await canvas(1024, WHITE, [await logoLayer(800)]);
  await sharp(only).toFile(`${OUT}/icon-only.png`);
  console.log("  icon-only.png        1024x1024  logo 800px wide");

  const fg = await canvas(1024, { r: 0, g: 0, b: 0, alpha: 0 }, [await logoLayer(600)]);
  await sharp(fg).toFile(`${OUT}/icon-foreground.png`);
  console.log("  icon-foreground.png  1024x1024  logo 600px wide (inside 66.6% safe zone)");

  await canvas(1024, WHITE, []).then((b) => sharp(b).toFile(`${OUT}/icon-background.png`));
  console.log("  icon-background.png  1024x1024  flat white");
})();

/*
 * Splash lockup: logo with the school name set underneath it.
 *
 * This replaces @capacitor/assets for the splash entirely. That tool emits one
 * bitmap per density/orientation bucket at fixed aspect ratios (port xxxhdpi is
 * 1280x1920 = 0.667), but a real device screen is a different ratio (this one is
 * 1080x2220 = 0.486). A bitmap used as `android:background` is stretched to fill
 * the window, so those two ratios differ by ~0.73 per axis and the logo comes
 * out visibly squashed - the "oval" look.
 *
 * Instead the lockup is shown through a layer-list with android:gravity
 * "center", which centres without scaling, so the logo stays pixel-identical on
 * every screen. Two consequences drive the layout below:
 *
 *   - The lockup must be emitted per density bucket. `android:gravity` never
 *     scales, so one oversized master bitmap would simply be clipped on a 1080px
 *     screen. Android scales by the density ratio, which preserves aspect, so
 *     per-bucket sizing is safe.
 *   - It must not live in drawable-nodpi, because a fixed pixel size cannot fit
 *     both a 720px budget phone and a 1440px flagship.
 *
 * Widths are tuned to roughly 40-57% of the screen at each density so the lockup
 * is comfortably inside the frame everywhere.
 */
console.log("\nsplash lockup:");
const BUCKETS = [
  ["ldpi", 140],
  ["mdpi", 200],
  ["hdpi", 300],
  ["xhdpi", 420],
  ["xxhdpi", 620],
  ["xxxhdpi", 780],
];

// Rendered large once, then downscaled per bucket so the wordmark and crest stay
// crisp at every density.
const logoW = 1040;
const logoH = Math.round(logoW / aspect);
const wordmark = await renderWordmark(150);
const gap = 140;
const sideMargin = 100;

const lockupW = Math.max(logoW, wordmark.w) + sideMargin * 2;
const lockupH = logoH + gap + wordmark.h + sideMargin;

const master = await sharp({
  create: {
    width: lockupW,
    height: lockupH,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([
    {
      input: await sharp(LOGO).resize(logoW, logoH, { fit: "fill" }).png().toBuffer(),
      left: Math.round((lockupW - logoW) / 2),
      top: 0,
    },
    {
      input: wordmark.buf,
      left: Math.round((lockupW - wordmark.w) / 2),
      top: logoH + gap,
    },
  ])
  .png({ compressionLevel: 9 })
  .toBuffer();

await sharp(master).toFile(`${OUT}/splash-lockup.png`);
console.log(
  `  splash-lockup.png (master)  ${lockupW}x${lockupH}  logo ${logoW}x${logoH} + "${SCHOOL_NAME}" ${wordmark.w}x${wordmark.h}`,
);

/*
 * Web copy for the #boot launch overlay in mobile/index.html.
 *
 * That overlay renders the lockup at min(50vw, 300px), which on a ~420dpi phone
 * is roughly 540 physical pixels, so 760px wide covers it with headroom for
 * denser screens without carrying the 1575px master over the wire on every cold
 * start.
 */
const WEB_LOCKUP_W = 760;
const webLockupH = Math.round((lockupH / lockupW) * WEB_LOCKUP_W);
await sharp(master)
  .resize({ width: WEB_LOCKUP_W })
  .png({ compressionLevel: 9, palette: true, quality: 92 })
  .toFile("public/splash-lockup.png");
console.log(
  `  public/splash-lockup.png  ${WEB_LOCKUP_W}x${webLockupH}  -> used by the #boot overlay`,
);

for (const [bucket, width] of BUCKETS) {
  const dir = `${RES}/drawable-${bucket}`;
  mkdirSync(dir, { recursive: true });
  const resized = await sharp(master).resize({ width }).png({ compressionLevel: 9 }).toBuffer();
  await sharp(resized).toFile(`${dir}/splash_lockup.png`);
  console.log(
    `  drawable-${bucket.padEnd(8)} ${width}px wide -> res/drawable-${bucket}/splash_lockup.png`,
  );
}

console.log("\ndone.");
