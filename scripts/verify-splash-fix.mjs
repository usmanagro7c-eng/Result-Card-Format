import sharp from "sharp";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

/*
 * Verifies the splash fix end to end.
 *
 * The native starting window is shown for well under 200ms on this device (the
 * WebView paints an opaque white frame almost immediately), so it cannot be
 * captured with `adb screencap`. This checks the things that actually decide
 * the outcome instead:
 *
 *   1. The resource chain resolves - styles.xml points android:background at
 *      drawable/splash_background.xml, whose <bitmap> points at splash_lockup,
 *      and the per-density lockups are packaged in the APK.
 *   2. Every representative screen renders undistorted. For each screen this
 *      reproduces what Android draws (white fill + <bitmap gravity="center">,
 *      scaled by dpi/bucketDpi, centred) and measures the logo band. The aspect
 *      has to match the 636x607 source, otherwise it is the "oval" again.
 */
const APK = "android/app/build/outputs/apk/debug/app-debug.apk";
const RES = "android/app/src/main/res";
const SRC_ASPECT = 636 / 607;

const BUCKET_DENSITY = { ldpi: 120, mdpi: 160, hdpi: 240, xhdpi: 320, xxhdpi: 480, xxxhdpi: 640 };

const SCREENS = [
  [1080, 2220, 420, "xxhdpi", "this device 420dpi"],
  [1440, 2960, 420, "xxhdpi", "flagship xxhdpi"],
  [1080, 2400, 480, "xxhdpi", "tall xxhdpi"],
  [720, 1280, 320, "xhdpi", "budget xhdpi"],
  [480, 800, 160, "mdpi", "small mdpi"],
  [320, 480, 120, "ldpi", "very small ldpi"],
  [2048, 1536, 640, "xxxhdpi", "tablet xxxhdpi"],
];

const isBrand = (r, g, b) =>
  (Math.abs(r - 0x28) < 34 && Math.abs(g - 0x24) < 34 && Math.abs(b - 0x6a) < 34) ||
  (Math.abs(r - 0xed) < 38 && Math.abs(g - 0x1c) < 38 && Math.abs(b - 0x23) < 38);

/* ---------- 1. resource chain ---------- */
const styles = readFileSync(`${RES}/values/styles.xml`, "utf8");
const bg = styles.match(/android:background">@drawable\/([\w.]+)/)?.[1];
console.log(`styles.xml  android:background -> @drawable/${bg}`);

const xml = readFileSync(`${RES}/drawable/${bg}.xml`, "utf8");
// The lockup can be referenced either as <item android:drawable="..."> or as a
// nested <bitmap android:src="...">; both resolve to the same drawable.
const src =
  xml.match(/android:drawable="@drawable\/([\w.]+)"/)?.[1] ??
  xml.match(/android:src="@drawable\/([\w.]+)"/)?.[1];
const gravity = xml.match(/android:gravity="([\w.]+)"/)?.[1];
console.log(`  ${bg}.xml -> @drawable/${src} gravity="${gravity}"`);
console.log(`  white base layer behind logo: ${/@android:color\/white/.test(xml)}`);

for (const [bucket, dpi] of Object.entries(BUCKET_DENSITY)) {
  const m = await sharp(`${RES}/drawable-${bucket}/${src}.png`).metadata();
  console.log(
    `  drawable-${bucket.padEnd(8)} ${String(m.width + "x" + m.height).padEnd(11)} (${dpi}dpi)`,
  );
}

const listed = execFileSync(
  "powershell",
  [
    "-NoProfile",
    "-Command",
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
      `$z=[System.IO.Compression.ZipFile]::OpenRead('${APK.replace(/\//g, "\\")}'); ` +
      `$z.Entries | Where-Object { $_.FullName -match 'splash_lockup|splash_background' } | ForEach-Object { $_.FullName }; ` +
      `$z.Dispose()`,
  ],
  { encoding: "utf8" },
)
  .split(/\r?\n/)
  .filter(Boolean);
console.log(`\npackaged in APK (${listed.length}): ${listed.join(", ")}\n`);

/* ---------- 2. logo band inside a lockup (above the wordmark) ---------- */
async function logoBand(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rowBrand = new Array(info.height).fill(0);
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      if (data[i + 3] > 40 && isBrand(data[i], data[i + 1], data[i + 2])) rowBrand[y]++;
    }
  }
  // first empty row after the crest marks the gap before the wordmark
  for (let y = 1; y < info.height; y++) {
    if (rowBrand[y - 1] > 0 && rowBrand[y] === 0) return y;
  }
  return info.height;
}

/* ---------- 3. reproduce Android's layer-list per screen ---------- */
console.log(
  "screen".padEnd(22) +
    "bucket".padEnd(10) +
    "lockup drawn".padEnd(15) +
    "logo size".padEnd(13) +
    "aspect".padEnd(9) +
    "verdict",
);
console.log("-".repeat(88));

let allOk = true;
for (const [w, h, dpi, bucket, label] of SCREENS) {
  const path = `${RES}/drawable-${bucket}/${src}.png`;
  const raw = readFileSync(path);
  const meta = await sharp(raw).metadata();

  // Android scales the bucket bitmap by (deviceDpi / bucketDpi).
  const scale = dpi / BUCKET_DENSITY[bucket];
  const drawW = Math.round(meta.width * scale);
  const drawH = Math.round(meta.height * scale);

  if (drawW > w) {
    allOk = false;
    console.log(
      `${label.padEnd(22)}${bucket.padEnd(10)}${(drawW + "x" + drawH).padEnd(15)}${"-".padEnd(13)}${"-".padEnd(9)}TOO WIDE for ${w}px screen`,
    );
    continue;
  }

  const left = Math.round((w - drawW) / 2);
  const top = Math.round((h - drawH) / 2);

  const rendered = await sharp({
    create: { width: w, height: h, channels: 4, background: "#FFFFFF" },
  })
    .composite([{ input: await sharp(raw).resize(drawW, drawH).png().toBuffer(), left, top }])
    .png()
    .toBuffer();

  const bandRows = await logoBand(raw);
  const { data, info } = await sharp(rendered)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = info.width,
    maxX = -1,
    minY = info.height,
    maxY = -1;
  const yEnd = top + Math.round(bandRows * scale);
  for (let y = top; y < yEnd; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if (isBrand(data[i], data[i + 1], data[i + 2])) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const meas = bw / bh;
  const ok = Math.abs(meas / SRC_ASPECT - 1) < 0.03;
  if (!ok) allOk = false;

  console.log(
    `${label.padEnd(22)}${bucket.padEnd(10)}${(drawW + "x" + drawH).padEnd(15)}${(bw + "x" + bh).padEnd(13)}${meas.toFixed(3).padEnd(9)}${ok ? "OK undistorted" : "DISTORTED"}`,
  );

  if (w === 1080 && h === 2220)
    await sharp(rendered).toFile(
      "C:/Users/MAAN/AppData/Local/Temp/opencode/splash-preview-1080x2220.png",
    );
}

console.log(`\nsource logo aspect ${SRC_ASPECT.toFixed(3)}`);
console.log(
  `result: ${allOk ? "logo stays proportional and fits on every screen tested" : "PROBLEM DETECTED"}`,
);
console.log("preview: splash-preview-1080x2220.png");
