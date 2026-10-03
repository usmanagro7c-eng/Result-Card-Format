import sharp from "sharp";

/*
 * Measures the splash logo's rendered aspect ratio straight off a device
 * screenshot, so the "it looks oval" complaint can be checked numerically
 * instead of by eye.
 *
 * A stretch-free logo must measure ~1.048 (the 636x607 source). Anything
 * meaningfully below 1.0 means it has been squashed horizontally, which is
 * exactly what an oval-looking logo is.
 */
const file = process.argv[2];
const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width,
  H = info.height,
  ch = info.channels;

let minX = W,
  maxX = -1,
  minY = H,
  maxY = -1,
  navy = 0,
  red = 0;

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * ch;
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const isNavy = Math.abs(r - 0x28) < 34 && Math.abs(g - 0x24) < 34 && Math.abs(b - 0x6a) < 34;
    const isRed = Math.abs(r - 0xed) < 38 && Math.abs(g - 0x1c) < 38 && Math.abs(b - 0x23) < 38;
    if (isNavy) navy++;
    if (isRed) red++;
    if (isNavy || isRed) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

console.log(`file        : ${file}`);
console.log(`screen      : ${W}x${H}`);
console.log(`brand pixels: navy ${navy}, red ${red}`);
if (maxX < 0) {
  console.log("no TCS brand pixels in this frame (not the splash)");
  process.exit(0);
}
const bw = maxX - minX + 1;
const bh = maxY - minY + 1;
const measured = bw / bh;
console.log(`logo bbox   : x ${minX}..${maxX}  y ${minY}..${maxY}`);
console.log(`logo size   : ${bw}x${bh}`);
console.log(`measured w/h: ${measured.toFixed(3)}`);
console.log(`source   w/h: 1.048  (636x607)`);
const ratio = measured / (636 / 607);
console.log(`\nverdict: ${ratio.toFixed(2)}x the source ratio`);
console.log(
  ratio < 0.92
    ? "STRETCHED (squashed horizontally) - this is the oval look"
    : ratio > 1.09
      ? "STRETCHED (elongated vertically)"
      : "correct - logo is round / undistorted",
);
