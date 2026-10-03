/*
 * Authoritative launcher-icon check.
 *
 * Reads the icon straight out of the built APK rather than trusting a
 * screenshot of the launcher, which is ambiguous (wallpaper, widgets, search
 * chrome and other icons can all contribute navy/red pixels).
 *
 * For an adaptive icon the launcher composes background + foreground and then
 * masks both to the centre 72/108 of the canvas, so both layers are checked
 * here as well as the legacy ic_launcher.png used by pre-API-26 launchers.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const APK = "android/app/build/outputs/apk/debug/app-debug.apk";

const want = [
  "res/mipmap-xxxhdpi-v4/ic_launcher.png",
  "res/mipmap-xxxhdpi-v4/ic_launcher_round.png",
  "res/mipmap-xxxhdpi-v4/ic_launcher_foreground.png",
  "res/mipmap-xxxhdpi-v4/ic_launcher_background.png",
  "res/mipmap-mdpi-v4/ic_launcher.png",
];

// Pull the raw bytes of each entry straight out of the zip.
function entryBytes(name) {
  const tmp = "C:/Users/MAAN/AppData/Local/Temp/opencode/apkentry";
  execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
        `$z=[System.IO.Compression.ZipFile]::OpenRead('${APK.replace(/\//g, "\\")}'); ` +
        `$e=$z.Entries | Where-Object { $_.FullName -eq '${name}' }; ` +
        `if ($e) { $s=$e.Open(); $fs=[System.IO.File]::Create('${tmp}'); $s.CopyTo($fs); $fs.Close(); $s.Close() } else { $fs=[System.IO.File]::Create('${tmp}'); $fs.Close() }; $z.Dispose()`,
    ],
    { stdio: "ignore" },
  );
  return readFileSync(tmp);
}

const stats = (buf) =>
  sharp(buf)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => {
      let navy = 0,
        red = 0,
        white = 0;
      const n = info.width * info.height;
      for (let i = 0; i < data.length; i += info.channels) {
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2];
        if (Math.abs(r - 0x28) < 34 && Math.abs(g - 0x24) < 34 && Math.abs(b - 0x6a) < 34) navy++;
        if (Math.abs(r - 0xed) < 38 && Math.abs(g - 0x1c) < 38 && Math.abs(b - 0x23) < 38) red++;
        if (r > 236 && g > 236 && b > 236) white++;
      }
      return { size: `${info.width}x${info.height}`, navy, red, white, n };
    });

console.log(`APK: ${APK}\n`);
console.log(
  "entry".padEnd(48) +
    "size".padEnd(12) +
    "navy%".padStart(8) +
    "red%".padStart(8) +
    "white%".padStart(8) +
    "   verdict",
);
console.log("-".repeat(104));

for (const name of want) {
  const buf = entryBytes(name);
  if (!buf.length) {
    console.log(name.padEnd(48) + "MISSING FROM APK");
    continue;
  }
  const s = await stats(buf);
  const pc = (v) => ((v / s.n) * 100).toFixed(2);
  const brand = s.navy + s.red;
  const verdict = name.includes("background")
    ? brand === 0
      ? "OK flat white background (no artwork, as intended)"
      : "unexpected artwork in background layer"
    : brand / s.n > 0.02
      ? "OK contains TCS logo"
      : "NO TCS COLOURS";
  console.log(
    name.replace("res/mipmap-", "").padEnd(48) +
      s.size.padEnd(12) +
      pc(s.navy).padStart(8) +
      pc(s.red).padStart(8) +
      pc(s.white).padStart(8) +
      "   " +
      verdict,
  );
}
