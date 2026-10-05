/*
 * Confirms the installed APK's JS bundle actually contains the launch-overlay
 * dismissal logic from mobile/main.tsx, and that the CSS bundle carries the boot
 * styles.
 *
 * The bundle filename is content-hashed, so it is resolved from the entry chunk
 * that index.html references rather than globbed.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const APK = process.argv[2];

function entry(name) {
  const tmp = "C:/Users/MAAN/AppData/Local/Temp/opencode/_bundle.js";
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
  return buf.length ? buf.toString("utf8") : null;
}

const html = entry("assets/public/index.html");
const main = html.match(/src="\/assets\/(index-[^"]+\.js)"/)?.[1];
const css = html.match(/href="\/assets\/(styles-[^"]+\.css)"/)?.[1];

if (!main) {
  console.error("could not resolve the entry chunk from index.html");
  process.exit(1);
}

const js = entry(`assets/public/assets/${main}`) ?? "";
const cssText = css ? (entry(`assets/public/assets/${css}`) ?? "") : "";

// Accept ', " or ` around the id: the minifier rewrites quotes, so matching only
// one style produces a false "stale" verdict.
const anyQuote = (s) => `[\x27"\x60]${s}[\x27"\x60]`;

// The #boot rules ship INLINE in mobile/index.html, not in the extracted
// stylesheet. src/styles.css becomes styles-*.css, but the launch overlay CSS
// never leaves the HTML. So the CSS checks must read index.html.
const checks = [
  ["entry chunk resolved", !!main, main],
  [
    "getElementById('boot') lookup",
    new RegExp(`getElementById\\(${anyQuote("boot")}\\)`).test(js),
    "finds the overlay",
  ],
  ["boot--done class applied", /boot--done/.test(js), "triggers the fade-out"],
  ["overlay removed after fade", /\.remove\(\)/.test(js), "so it can never block taps"],
  [
    "waits for a real paint",
    (js.match(/requestAnimationFrame/g) ?? []).length >= 2,
    "double rAF before hiding",
  ],
  ["onRendered subscription", /onRendered/.test(js), "holds the splash until React renders"],
  ["backstop timeout present", /4000|4e3/.test(js), "never leaves the user stuck on a splash"],
  ["app itself is in the bundle", /RouterProvider|createRoot/.test(js), "React root mounts"],
  ["html: #boot rules", /#boot\b/.test(html), "the branded screen exists"],
  ["html: boot--done transition", /boot--done/.test(html), "fades out"],
  ["html: 240px bar width", /width:\s*240px/.test(html), "matches native 240dp"],
  ["html: boot-slide keyframes", /boot-slide/.test(html), "animated loading bar"],
  ["html: 84px from bottom", /84px/.test(html), "matches native splash_bar offset"],
  ["html: prefers-reduced-motion", /prefers-reduced-motion/.test(html), "accessibility fallback"],
  ["app stylesheet packaged", cssText.length > 1000, `${cssText.length} bytes of src/styles.css`],
];

console.log(`entry chunk : assets/${main}`);
console.log(`app css     : assets/${css ?? "not referenced"} (${cssText.length} bytes)`);
console.log(`#boot css   : inline in index.html (${html.length} bytes)\n`);
console.log("check".padEnd(32) + "verdict".padEnd(11) + "detail");
console.log("-".repeat(92));

let failed = 0;
for (const [label, pass, detail] of checks) {
  if (!pass) failed++;
  console.log(`${label.padEnd(40)}${pass ? "OK" : "MISSING".padEnd(9)}${detail ?? ""}`);
}

console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
console.log(
  failed === 0 ? "installed bundle contains the current launch logic" : "bundle is STALE",
);
process.exit(failed === 0 ? 0 : 1);
