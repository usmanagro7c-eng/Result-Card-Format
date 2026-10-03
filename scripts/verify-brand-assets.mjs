import sharp from "sharp";

const files = [
  "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png",
  "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png",
  "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png",
  "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_background.png",
  "android/app/src/main/res/mipmap-mdpi/ic_launcher.png",
  "android/app/src/main/res/drawable-port-xxxhdpi/splash.png",
  "android/app/src/main/res/drawable-land-xxxhdpi/splash.png",
  "android/app/src/main/res/drawable/splash.png",
];

const isTcs = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  // TCS navy #28246A and red #ED1C23, tolerant of JPEG-ish drift
  const near = (tr, tg, tb, tol) =>
    Math.abs(r - tr) < tol && Math.abs(g - tg) < tol && Math.abs(b - tb) < tol;
  return near(0x28, 0x24, 0x6a, 26)
    ? "navy"
    : near(0xed, 0x1c, 0x23, 30)
      ? "red"
      : near(0xff, 0xff, 0xff, 6)
        ? "white"
        : null;
};

console.log(
  "file                                                        size    TCS colours present",
);
console.log("-".repeat(96));
for (const f of files) {
  const img = sharp(f);
  const m = await img.metadata();
  const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const counts = { navy: 0, red: 0, white: 0, other: 0 };
  const seen = new Set();
  for (let i = 0; i < data.length; i += info.channels) {
    const hex =
      "#" +
      [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("");
    const k = isTcs(hex);
    if (k) counts[k]++;
    else {
      counts.other++;
      if (seen.size < 6) seen.add(hex);
    }
  }
  const total = counts.navy + counts.red + counts.white + counts.other;
  const pct = (n) => ((n / total) * 100).toFixed(1) + "%";
  const verdict =
    counts.navy + counts.red > total * 0.01
      ? `YES  navy ${pct(counts.navy)} red ${pct(counts.red)} white ${pct(counts.white)}`
      : `NO   navy ${pct(counts.navy)} red ${pct(counts.red)} | stray colours: ${[...seen].join(" ")}`;
  console.log(
    `${f.replace("android/app/src/main/res/", "").padEnd(56)} ${String(m.width + "x" + m.height).padEnd(8)} ${verdict}`,
  );
}
