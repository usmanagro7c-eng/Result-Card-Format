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
 * 2. High-End Royal Executive Splash Lockup (Center Artwork)
 * -------------------------------------------------------------
 */
console.log("\ngenerating royal executive splash lockup:");

const LOCKUP_CANVAS_W = 1200;
const LOCKUP_CANVAS_H = 1350;

const crestW = 580;
const crestH = Math.round(crestW / aspect);
const crestTop = 30;

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
  <g transform="translate(${LOCKUP_CANVAS_W / 2}, ${crestTop + crestH + 45})" text-anchor="middle">
    
    <!-- School Title -->
    <text y="0" font-family="'Segoe UI', -apple-system, sans-serif" font-size="64" font-weight="800" fill="#1e1b4b" letter-spacing="1.2">
      The Country School
    </text>

    <!-- Motto -->
    <text y="52" font-family="'Segoe UI', -apple-system, sans-serif" font-size="26" font-weight="600" font-style="italic" fill="#64748b" letter-spacing="0.5">
      Towards Academic Excellence
    </text>

    <!-- Ornamental Gold Divider -->
    <g transform="translate(0, 92)">
      <line x1="-160" y1="0" x2="-22" y2="0" stroke="url(#goldLineL)" stroke-width="2.5" stroke-linecap="round" />
      <polygon points="0,-7 7,0 0,7 -7,0" fill="#d97706" />
      <line x1="22" y1="0" x2="160" y2="0" stroke="url(#goldLineR)" stroke-width="2.5" stroke-linecap="round" />
    </g>

    <!-- Modern Navy Pill Badge -->
    <g transform="translate(0, 142)">
      <rect x="-225" y="0" width="450" height="56" rx="28" fill="#28246a" />
      <rect x="-224" y="1" width="448" height="54" rx="27" fill="none" stroke="#4338ca" stroke-width="1.5" opacity="0.5" />
      
      <!-- Academic Cap Icon -->
      <g transform="translate(-178, 15) scale(1.1)">
        <path d="M12 2L1 7l11 5 9-4.09V17h2V7L12 2z" fill="#f59e0b" />
        <path d="M4.5 10.5V16c0 2.5 3.5 4.5 7.5 4.5s7.5-2 7.5-4.5v-5.5l-7.5 3.4-7.5-3.4z" fill="#f59e0b" />
      </g>

      <text x="14" y="37" font-family="'Segoe UI', -apple-system, sans-serif" font-size="21" font-weight="700" fill="#ffffff" letter-spacing="2.2">
        RESULT CARD PORTAL
      </text>
    </g>

    <text y="250" font-family="'Segoe UI', -apple-system, sans-serif" font-size="18" font-weight="700" fill="#94a3b8" letter-spacing="2">
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
console.log("  saved splash-lockup.png (master)");

/*
 * -------------------------------------------------------------
 * 3. Bottom Footer Artwork (Grounded Verified Seal)
 * -------------------------------------------------------------
 */
console.log("\ngenerating splash footer:");

const FOOTER_CANVAS_W = 1000;
const FOOTER_CANVAS_H = 160;

const footerSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${FOOTER_CANVAS_W}" height="${FOOTER_CANVAS_H}" viewBox="0 0 ${FOOTER_CANVAS_W} ${FOOTER_CANVAS_H}">
  <g transform="translate(${FOOTER_CANVAS_W / 2}, 60)" text-anchor="middle">
    <!-- Verified Shield Icon -->
    <circle cx="0" cy="-38" r="16" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.8" />
    <path d="M-6 -38 L-2 -34 L6 -42" fill="none" stroke="#28246a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

    <text y="-4" font-family="'Segoe UI', -apple-system, sans-serif" font-size="22" font-weight="700" fill="#475569" letter-spacing="2.2">
      THE COUNTRY SCHOOL SYSTEM
    </text>
    <text y="26" font-family="'Segoe UI', -apple-system, sans-serif" font-size="16" font-weight="600" fill="#94a3b8" letter-spacing="1.2">
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
 * 4. Density-Aware Android Resource Sizing
 * -------------------------------------------------------------
 */
const BUCKETS = [
  { bucket: "ldpi", lockupW: 160, footerW: 180 },
  { bucket: "mdpi", lockupW: 220, footerW: 250 },
  { bucket: "hdpi", lockupW: 330, footerW: 370 },
  { bucket: "xhdpi", lockupW: 440, footerW: 490 },
  { bucket: "xxhdpi", lockupW: 660, footerW: 730 },
  { bucket: "xxxhdpi", lockupW: 820, footerW: 900 },
];

console.log("\nemitting android density buckets:");
for (const { bucket, lockupW: lw, footerW: fw } of BUCKETS) {
  const dir = `${RES}/drawable-${bucket}`;
  mkdirSync(dir, { recursive: true });

  const resizedLockup = await sharp(lockupMaster).resize({ width: lw }).png({ compressionLevel: 9 }).toBuffer();
  await sharp(resizedLockup).toFile(`${dir}/splash_lockup.png`);

  const resizedFooter = await sharp(footerMaster).resize({ width: fw }).png({ compressionLevel: 9 }).toBuffer();
  await sharp(resizedFooter).toFile(`${dir}/splash_footer.png`);

  console.log(`  drawable-${bucket.padEnd(8)} lockup: ${lw}px, footer: ${fw}px`);
}

console.log("\nbrand assets generated successfully.");
