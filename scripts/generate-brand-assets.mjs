import sharp from "sharp";
import { mkdirSync } from "node:fs";

/*
 * Regenerates the brand source art in `assets/` and installs the Android
 * splash lockup and footer into res/.
 *
 *   node scripts/generate-brand-assets.mjs
 */
const LOGO = "public/TCS Logo.png";
const OUT = "assets";
const RES = "android/app/src/main/res";

const WHITE = "#FFFFFF";
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

/*
 * -------------------------------------------------------------
 * 1. Launcher Icons
 * -------------------------------------------------------------
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
 * -------------------------------------------------------------
 * 2. High-End Royal Executive Splash Lockup (Center Artwork - Enlarged)
 * -------------------------------------------------------------
 */
console.log("\ngenerating royal executive splash lockup (enlarged & prominent):");

const LOCKUP_CANVAS_W = 1200;
const LOCKUP_CANVAS_H = 1500;

// Crest enlarged to 760px wide (more prominent on all screens)
const crestW = 760;
const crestH = Math.round(crestW / aspect);
const crestTop = 20;

const lockupSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${LOCKUP_CANVAS_W}" height="${LOCKUP_CANVAS_H}" viewBox="0 0 ${LOCKUP_CANVAS_W} ${LOCKUP_CANVAS_H}">
  <defs>
    <!-- Subtle accent line gradients -->
    <linearGradient id="goldLineL" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#e2e8f0" stop-opacity="0" />
      <stop offset="100%" stop-color="#d97706" stop-opacity="1" />
    </linearGradient>
    <linearGradient id="goldLineR" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#d97706" stop-opacity="1" />
      <stop offset="100%" stop-color="#e2e8f0" stop-opacity="0" />
    </linearGradient>
  </defs>

  <!-- Centered Content below Crest -->
  <g transform="translate(${LOCKUP_CANVAS_W / 2}, ${crestTop + crestH + 48})" text-anchor="middle">
    
    <!-- School Title - Larger & Bolder -->
    <text y="0" font-family="'Segoe UI', -apple-system, sans-serif" font-size="78" font-weight="800" fill="#1e1b4b" letter-spacing="1.5">
      The Country School
    </text>

    <!-- Motto -->
    <text y="58" font-family="'Segoe UI', -apple-system, sans-serif" font-size="32" font-weight="600" font-style="italic" fill="#64748b" letter-spacing="0.6">
      Towards Academic Excellence
    </text>

    <!-- Ornamental Gold Divider -->
    <g transform="translate(0, 106)">
      <line x1="-190" y1="0" x2="-24" y2="0" stroke="url(#goldLineL)" stroke-width="3" stroke-linecap="round" />
      <polygon points="0,-8 8,0 0,8 -8,0" fill="#d97706" />
      <line x1="24" y1="0" x2="190" y2="0" stroke="url(#goldLineR)" stroke-width="3" stroke-linecap="round" />
    </g>

    <!-- Modern Navy Pill Badge -->
    <g transform="translate(0, 160)">
      <rect x="-265" y="0" width="530" height="66" rx="33" fill="#28246a" />
      <rect x="-264" y="1" width="528" height="64" rx="32" fill="none" stroke="#4338ca" stroke-width="1.8" opacity="0.5" />
      
      <!-- Academic Cap Icon -->
      <g transform="translate(-215, 17) scale(1.3)">
        <path d="M12 2L1 7l11 5 9-4.09V17h2V7L12 2z" fill="#f59e0b" />
        <path d="M4.5 10.5V16c0 2.5 3.5 4.5 7.5 4.5s7.5-2 7.5-4.5v-5.5l-7.5 3.4-7.5-3.4z" fill="#f59e0b" />
      </g>

      <text x="16" y="44" font-family="'Segoe UI', -apple-system, sans-serif" font-size="25" font-weight="700" fill="#ffffff" letter-spacing="2.6">
        RESULT CARD PORTAL
      </text>
    </g>

    <text y="285" font-family="'Segoe UI', -apple-system, sans-serif" font-size="22" font-weight="700" fill="#94a3b8" letter-spacing="2.5">
      OFFICIAL EVALUATION SYSTEM
    </text>

  </g>
</svg>
`;

const crestBuf = await sharp(LOGO)
  .resize(crestW, crestH, { fit: "contain" })
  .png()
  .toBuffer();

const lockupMaster = await sharp({
  create: {
    width: LOCKUP_CANVAS_W,
    height: LOCKUP_CANVAS_H,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([
    {
      input: crestBuf,
      left: Math.round((LOCKUP_CANVAS_W - crestW) / 2),
      top: crestTop,
    },
    {
      input: Buffer.from(lockupSvg),
      left: 0,
      top: 0,
    },
  ])
  .trim() // Trim transparent boundaries tightly
  .png({ compressionLevel: 9 })
  .toBuffer();

await sharp(lockupMaster).toFile(`${OUT}/splash-lockup.png`);
await sharp(lockupMaster).toFile(`public/splash-lockup.png`);
console.log("  saved splash-lockup.png (master enlarged)");

/*
 * -------------------------------------------------------------
 * 3. Bottom Footer Artwork (Grounded Verified Seal - Enlarged)
 * -------------------------------------------------------------
 */
console.log("\ngenerating splash footer:");

const FOOTER_CANVAS_W = 1100;
const FOOTER_CANVAS_H = 190;

const footerSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${FOOTER_CANVAS_W}" height="${FOOTER_CANVAS_H}" viewBox="0 0 ${FOOTER_CANVAS_W} ${FOOTER_CANVAS_H}">
  <g transform="translate(${FOOTER_CANVAS_W / 2}, 70)" text-anchor="middle">
    <!-- Verified Shield Icon -->
    <circle cx="0" cy="-44" r="18" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2" />
    <path d="M-7 -44 L-2 -39 L7 -49" fill="none" stroke="#28246a" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />

    <text y="-6" font-family="'Segoe UI', -apple-system, sans-serif" font-size="26" font-weight="700" fill="#475569" letter-spacing="2.4">
      THE COUNTRY SCHOOL SYSTEM
    </text>
    <text y="28" font-family="'Segoe UI', -apple-system, sans-serif" font-size="19" font-weight="600" fill="#94a3b8" letter-spacing="1.4">
      ACADEMIC SESSION 2026–2027
    </text>
  </g>
</svg>
`;

const footerMaster = await sharp({
  create: {
    width: FOOTER_CANVAS_W,
    height: FOOTER_CANVAS_H,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([
    {
      input: Buffer.from(footerSvg),
      left: 0,
      top: 0,
    },
  ])
  .trim()
  .png({ compressionLevel: 9 })
  .toBuffer();

await sharp(footerMaster).toFile(`${OUT}/splash-footer.png`);
console.log("  saved splash-footer.png (master)");

/*
 * -------------------------------------------------------------
 * 4. Density-Aware Android Resource Sizing (Enlarged)
 * -------------------------------------------------------------
 */
const BUCKETS = [
  { bucket: "ldpi", lockupW: 220, footerW: 240 },
  { bucket: "mdpi", lockupW: 300, footerW: 330 },
  { bucket: "hdpi", lockupW: 460, footerW: 500 },
  { bucket: "xhdpi", lockupW: 620, footerW: 660 },
  { bucket: "xxhdpi", lockupW: 880, footerW: 940 },
  { bucket: "xxxhdpi", lockupW: 1060, footerW: 1100 },
];

console.log("\nemitting enlarged android density buckets:");
for (const { bucket, lockupW: lw, footerW: fw } of BUCKETS) {
  const dir = `${RES}/drawable-${bucket}`;
  mkdirSync(dir, { recursive: true });

  const resizedLockup = await sharp(lockupMaster).resize({ width: lw }).png({ compressionLevel: 9 }).toBuffer();
  await sharp(resizedLockup).toFile(`${dir}/splash_lockup.png`);

  const resizedFooter = await sharp(footerMaster).resize({ width: fw }).png({ compressionLevel: 9 }).toBuffer();
  await sharp(resizedFooter).toFile(`${dir}/splash_footer.png`);

  console.log(`  drawable-${bucket.padEnd(8)} lockup: ${lw}px, footer: ${fw}px`);
}

console.log("\nenlarged brand assets generated successfully.");
