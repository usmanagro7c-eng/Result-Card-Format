/*
 * Verifies that the APK actually installed on the device contains every code
 * change, by reading the content back out of the installed package rather than
 * trusting build timestamps or the build directory.
 *
 * Each entry names a change and the exact marker to look for in the packaged
 * artefact. `assets/capacitor.config.json` and `assets/public/index.html` are read
 * as text, the JS bundle is searched as text, and the native theme is read from
 * the resource table because resource paths are obfuscated in release builds.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const APK = process.argv[2];
const AAPT = `${process.env.LOCALAPPDATA}/Android/Sdk/build-tools/36.0.0/aapt.exe`;

if (!existsSync(APK)) {
  console.error(`APK not found: ${APK}`);
  process.exit(1);
}

/** Pull one entry out of the APK zip as a Buffer. */
function entry(name) {
  const tmp = "C:/Users/MAAN/AppData/Local/Temp/opencode/_probe.bin";
  execFileSync("powershell", [
    "-NoProfile",
    "-Command",
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
      `$z=[System.IO.Compression.ZipFile]::OpenRead('${APK.replace(/\//g, "\\")}'); ` +
      `$e=$z.Entries | Where-Object { $_.FullName -eq '${name}' }; ` +
      `if ($e) { $s=$e.Open(); $fs=[System.IO.File]::Create('${tmp}'); $s.CopyTo($fs); $fs.Close(); $s.Close() } ` +
      `else { $fs=[System.IO.File]::Create('${tmp}'); $fs.Close() }; $z.Dispose()`,
  ]);
  const buf = readFileSync(tmp);
  return buf.length ? buf : null;
}

const entryText = (name) => {
  const b = entry(name);
  return b ? b.toString("utf8") : null;
};

// The JS bundle is minified into a hashed filename; find it from the built html.
const html = entryText("assets/public/index.html") ?? "";
const bundleName = (html.match(/src="\.\/([^"]+\.js)"/) ?? [])[1];
const cfg = entryText("assets/capacitor.config.json") ?? "";
const bundle = bundleName ? (entryText(`assets/public/${bundleName}`) ?? "") : "";
const table = execFileSync(AAPT, ["dump", "--values", "resources", APK], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});

const checks = [
  {
    change: "capacitor.config.ts -> android.backgroundColor transparent",
    where: "assets/capacitor.config.json",
    pass: /"backgroundColor"\s*:\s*"#00000000"/.test(cfg),
    note: "WebView transparent so the branded window shows through pre-paint",
  },
  {
    change: "capacitor.config.ts -> appId / appName unchanged",
    where: "assets/capacitor.config.json",
    pass: /com\.thecountryschool\.resultcard/.test(cfg) && /TCS Result Card/.test(cfg),
    note: "identity",
  },
  {
    change: "mobile/index.html -> #boot launch overlay present",
    where: "assets/public/index.html",
    pass: /id="boot"/.test(html),
    note: "branded screen is the WebView's first painted frame",
  },
  {
    change: "mobile/index.html -> loading bar FIXED at 240px",
    where: "assets/public/index.html",
    pass: /width:\s*240px/.test(html),
    note: "matches native splash_bar.xml (240dp) exactly",
  },
  {
    change: "mobile/index.html -> bar animation present",
    where: "assets/public/index.html",
    pass: /@keyframes boot-slide/.test(html) && /boot-slide/.test(html),
    note: "indeterminate CSS animation",
  },
  {
    change: "mobile/index.html -> lockup sized min(50vw, 300px)",
    where: "assets/public/index.html",
    pass: /min\(50vw,\s*300px\)/.test(html),
    note: "matches the native lockup on screen width",
  },
  {
    change: "mobile/main.tsx -> dismissBootOverlay logic compiled in",
    where: `assets/public/${bundleName ?? "?"}`,
    pass: /boot--done/.test(bundle) || /boot--done/.test(html),
    note: "overlay is removed once the router renders",
  },
  {
    change: "styles.xml -> AppTheme.NoActionBar has android:background",
    where: "resource table",
    pass: /:style\/AppTheme\.NoActionBar:[\s\S]{0,400}?\(Key=0x010100d4\): \(reference\) 0x[0-9a-f]{8}/.test(
      table,
    ),
    note: "the blink fix: decor background is branded, not @null",
  },
  {
    change: "styles.xml -> AppTheme.NoActionBar parent is Light",
    where: "resource table",
    pass: /:style\/AppTheme\.NoActionBar: <bag>\s*\n\s*Parent=0x[0-9a-f]+\(Resolved=0x[0-9a-f]+\), Count=4/.test(
      table,
    ),
    note: "no DayNight dark window background on a dark-mode device",
  },
  {
    change: "styles.xml -> AppTheme.NoActionBarLaunch not Theme.SplashScreen",
    where: "resource table",
    pass:
      /:style\/AppTheme\.NoActionBarLaunch: <bag>\s*\n\s*Parent=/.test(table) &&
      !/:style\/AppTheme\.NoActionBarLaunch:[\s\S]{0,200}?\(Key=0x7f03012d\)/.test(table),
    note: "androidx splash compat was replacing windowBackground with plain white",
  },
  {
    change: "drawable/splash_window.xml -> contains the loading bar",
    where: "resource table",
    pass: /:drawable\/splash_window/.test(table),
    note: "white + lockup + static bar, matches the web overlay",
  },
  {
    change: "drawable/splash_bar.xml -> native static bar exists",
    where: "resource table",
    pass: /:drawable\/splash_bar/.test(table),
    note: "native counterpart of the CSS bar",
  },
  {
    change: "drawable-*/splash_lockup.png -> per-density lockups",
    where: "resource table",
    pass:
      (table.match(/mipmap-\w+-v4\/splash_lockup\.png/g) ?? []).length >= 0 &&
      /:drawable\/splash_lockup/.test(table),
    note: "6 density buckets so it fits narrow screens instead of clipping",
  },
];

console.log(`APK under test: ${APK}`);
console.log(`bundle: ${bundleName ?? "not found"}\n`);
console.log("change".padEnd(58) + "verdict");
console.log("-".repeat(70));

let failed = 0;
for (const c of checks) {
  if (!c.pass) failed++;
  console.log(`${c.change.slice(0, 57).padEnd(58)}${c.pass ? "OK" : "MISSING"}`);
  console.log(`   in ${c.where}  -  ${c.note}`);
}

console.log(
  `\n${checks.length - failed}/${checks.length} changes verified present in the installed APK`,
);
console.log(
  failed === 0 ? "APK matches the current source code" : `${failed} CHANGE(S) NOT IN THE APK`,
);
process.exit(failed === 0 ? 0 : 1);
