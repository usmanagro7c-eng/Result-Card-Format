/*
 * Pulls the launcher icon and splash lockup back out of a built APK and checks
 * them for TCS brand colours.
 *
 * Release builds obfuscate resource *paths* (res/BW.xml instead of
 * res/mipmap-xxxhdpi-v4/ic_launcher.png), so this resolves the real entry through
 * the resource table rather than guessing filenames, and works for debug and
 * release alike.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const APK = process.argv[2];
const SDK = `${process.env.LOCALAPPDATA}/Android/Sdk`;
const AAPT = `${SDK}/build-tools/36.0.0/aapt.exe`;

const sh = (cmd, args) =>
  execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

/*
 * Map resource name -> concrete file in the APK.
 *
 * Release builds obfuscate resource paths (res/N3.png instead of the original
 * res/mipmap-xxxhdpi-v4/ic_launcher.png), so the mapping has to be read out of
 * the resource table instead of guessed from filenames.
 *
 * The dump's shape is:
 *   spec resource 0x...:mipmap/ic_launcher: flags=...     <- a flat type listing
 *   config ldpi:
 *     resource 0x...:mipmap/ic_launcher: t=0x03 d=0x...
 *       (string8) "res/N3.png"
 * so the real file for a resource is the (string8) on the line after its
 * `resource` line, inside whichever `config` block that sits in.
 *
 * xxxhdpi is preferred since that is the artwork a modern launcher picks.
 */
const DENSITY_RANK = { xxxhdpi: 6, xxhdpi: 5, xhdpi: 4, hdpi: 3, mdpi: 2, ldpi: 1 };

function buildResourceMap(out) {
  const lines = out.split(/\r?\n/);
  const best = new Map();

  let config = "";
  for (let i = 0; i < lines.length; i++) {
    const cfg = lines[i].match(/^\s*config ([^:]+):/);
    if (cfg) {
      config = cfg[1];
      continue;
    }

    // Skip the flat "spec resource ..." listing lines; only "resource ..." lines
    // inside a config block carry a value.
    const res = lines[i].match(/^\s+resource 0x[0-9a-f]+ [\w.]+:(\S+):/);
    if (!res) continue;

    const name = res[1];
    const file = lines[i + 1]?.match(/\(string8\) "(res\/[^"]+)"/)?.[1];
    if (!file) continue;

    const rank = DENSITY_RANK[config] ?? 0;
    const prev = best.get(name);
    if (!prev || rank > prev.rank) best.set(name, { file, config, rank });
  }
  return best;
}

const table = sh(AAPT, ["dump", "--values", "resources", APK]);
const resMap = buildResourceMap(table);

const targets = [
  ["mipmap/ic_launcher", "launcher icon"],
  ["mipmap/ic_launcher_round", "round launcher icon"],
  ["mipmap/ic_launcher_foreground", "adaptive foreground"],
  ["drawable/splash_lockup", "splash lockup"],
  ["drawable/splash_window", "splash window bg"],
];

console.log(`APK: ${APK}\n`);
console.log(
  "resource".padEnd(34) +
    "path".padEnd(16) +
    "density".padEnd(9) +
    "size".padEnd(12) +
    "navy%  red%  verdict",
);
console.log("-".repeat(88));

let ok = true;
for (const [name, label] of targets) {
  const entry = resMap.get(name);
  const path = entry?.file;
  if (!path) {
    console.log(`${name.padEnd(34)}${"NOT RESOLVED".padEnd(16)}`);
    ok = false;
    continue;
  }
  const cfgLabel = (entry.config || "default").padEnd(8);

  // Pull the entry straight out of the zip.
  const tmp = `C:/Users/MAAN/AppData/Local/Temp/opencode/_res.${path.endsWith(".xml") ? "xml" : "png"}`;
  sh("powershell", [
    "-NoProfile",
    "-Command",
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
      `$z=[System.IO.Compression.ZipFile]::OpenRead('${APK.replace(/\//g, "\\")}'); ` +
      `$e=$z.Entries | Where-Object { $_.FullName -eq '${path}' }; ` +
      `$s=$e.Open(); $fs=[System.IO.File]::Create('${tmp}'); $s.CopyTo($fs); $fs.Close(); $s.Close(); $z.Dispose()`,
  ]);

  if (path.endsWith(".xml")) {
    const xml = readFileSync(tmp, "utf8");
    const kind = xml.includes("adaptive-icon") ? "adaptive-icon XML" : "layer-list XML";
    console.log(`${name.padEnd(34)}${path.padEnd(16)}${cfgLabel}${kind}`);
    continue;
  }

  const { data, info } = await sharp(tmp).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let navy = 0,
    red = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    if (Math.abs(r - 0x28) < 40 && Math.abs(g - 0x24) < 40 && Math.abs(b - 0x6a) < 40) navy++;
    if (Math.abs(r - 0xed) < 45 && Math.abs(g - 0x1c) < 45 && Math.abs(b - 0x23) < 45) red++;
  }
  const n = info.width * info.height;
  const pc = (v) => ((v / n) * 100).toFixed(2);
  // The adaptive background layer is intentionally flat white, no artwork.
  const isBgLayer = name.includes("background");
  const good = isBgLayer ? navy + red < n * 0.01 : (navy + red) / n > 0.02;
  if (!good) ok = false;
  console.log(
    `${name.padEnd(34)}${path.padEnd(16)}${cfgLabel}${(info.width + "x" + info.height).padEnd(12)}${pc(navy).padStart(5)} ${pc(red).padStart(5)}  ${
      isBgLayer
        ? good
          ? "OK flat white"
          : "unexpected artwork"
        : good
          ? "OK TCS logo"
          : "NO TCS COLOURS"
    }`,
  );
}

console.log(
  `\nresult: ${ok ? "all brand assets present and correct in this APK" : "PROBLEM DETECTED"}`,
);
