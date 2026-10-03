import sharp from "sharp";

/*
 * Measures the TCS logo bbox inside each shipped splash drawable, so it can be
 * compared against the same measurement taken off a device screenshot. This
 * pins down whether distortion is introduced when @capacitor/assets renders the
 * source into each density/orientation bucket, or later by Android stretching
 * the drawable to fill the window.
 */
const files = [
  "android/app/src/main/res/drawable-port-xxxhdpi/splash.png",
  "android/app/src/main/res/drawable-port-xxhdpi/splash.png",
  "android/app/src/main/res/drawable-port-xhdpi/splash.png",
  "android/app/src/main/res/drawable/splash.png",
  "android/app/src/main/res/drawable-land-xxxhdpi/splash.png",
];

const SOURCE_ASPECT = 636 / 607;

for (const f of files) {
  const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width,
    H = info.height,
    ch = info.channels;

  let minX = W,
    maxX = -1,
    minY = H,
    maxY = -1,
    brand = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      const isNavy = Math.abs(r - 0x28) < 34 && Math.abs(g - 0x24) < 34 && Math.abs(b - 0x6a) < 34;
      const isRed = Math.abs(r - 0xed) < 38 && Math.abs(g - 0x1c) < 38 && Math.abs(b - 0x23) < 38;
      if (isNavy || isRed) {
        brand++;
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
  console.log(
    f.replace("android/app/src/main/res/", "").padEnd(40) +
      `${W}x${H}`.padEnd(11) +
      `bbox ${String(bw + "x" + bh).padEnd(10)}` +
      `fills ${(((bw / W) * 100).toFixed(0) + "% w").padEnd(9)}` +
      `logoAspect ${meas.toFixed(3)} (${(meas / SOURCE_ASPECT).toFixed(2)}x)`,
  );
}

console.log(`\nsource logo aspect: ${SOURCE_ASPECT.toFixed(3)}`);
