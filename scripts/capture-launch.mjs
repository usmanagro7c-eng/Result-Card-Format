/*
 * Records the launch with the device's own screenrecord and extracts every frame
 * with ffmpeg, so sub-100ms stages can actually be seen.
 *
 * This exists because adb screencap was measured at ~2459 ms/frame on this device,
 * which is roughly 25x too slow: a 150ms native starting window cannot appear in
 * any of those samples. A 60fps recording gives ~16ms per frame.
 *
 * Usage: node capture-launch.mjs <outDir> [seconds]
 */
import { execFileSync, execFile } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { promisify } from "node:util";

const pexec = promisify(execFile);
const OUT = process.argv[2] ?? "C:/Users/MAAN/AppData/Local/Temp/opencode/video";
const SECONDS = process.argv[3] ?? "6";

const ADB = `${process.env.LOCALAPPDATA}/Android/Sdk/platform-tools/adb.exe`;
const FFMPEG =
  "C:/Users/MAAN/AppData/Local/Temp/opencode/ff2/node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe";
const PKG = "com.thecountryschool.resultcard";
const REMOTE = "/sdcard/launch.mp4";

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) rmSync(`${OUT}/${f}`, { force: true, recursive: true });

const sh = async (cmd) => (await pexec(ADB, ["shell", cmd], { maxBuffer: 1 << 26 })).stdout;

console.log(`recording ${SECONDS}s of launch...`);
await sh(`am force-stop ${PKG}`);
await new Promise((r) => setTimeout(r, 3000));
await sh(`rm -f ${REMOTE}`);

// screenrecord has to already be running when the app starts, so record first and
// launch into the recording.
const rec = execFile(ADB, [
  "shell",
  `screenrecord --time-limit ${SECONDS} --size 1080x2220 --bit-rate 8000000 ${REMOTE}`,
]);
await new Promise((r) => setTimeout(r, 700));
await sh(`am start -n ${PKG}/.MainActivity`);

await new Promise((resolve) => {
  rec.on("exit", resolve);
  rec.on("close", resolve);
  setTimeout(resolve, (Number(SECONDS) + 4) * 1000);
});
await new Promise((r) => setTimeout(r, 800));

await sh(`rm -f /sdcard/launch_frames/*.png`);
await pexec(ADB, ["pull", REMOTE, `${OUT}/launch.mp4`]);
console.log(`pulled video (${existsSync(`${OUT}/launch.mp4`) ? "ok" : "MISSING"})`);

// Every frame.
await pexec(FFMPEG, ["-i", `${OUT}/launch.mp4`, "-vf", "fps=60", `${OUT}/f_%04d.png`]);
const frames = readdirSync(OUT).filter((f) => f.endsWith(".png"));
console.log(`extracted ${frames.length} frames at 60fps (~${(frames.length / 60).toFixed(2)}s)`);

// fps metadata so frame numbers can be read as timestamps
try {
  const probe = execFileSync(FFMPEG, [
    "-i",
    `${OUT}/launch.mp4`,
    "-hide_banner",
    "-f",
    "null",
    "-",
  ]).toString();
  const dur = probe.match(/Duration: (\d+):(\d+):([\d.]+)/);
  if (dur) {
    const secs = Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]);
    console.log(
      `video duration ${secs.toFixed(2)}s -> ~${(secs * 1000) / frames.length}ms per frame`,
    );
  }
} catch {
  /* duration is informational */
}

await sh(`rm -f ${REMOTE}`);
console.log(`frames in ${OUT}`);
