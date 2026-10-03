import sharp from "sharp";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RES = "android/app/src/main/res";

const dirs = readdirSync(RES).filter((d) => d.startsWith("drawable"));

console.log("splash drawables currently in res/:");
console.log("file".padEnd(46) + "size".padEnd(12) + "w/h aspect");
console.log("-".repeat(72));
for (const d of dirs) {
  const p = join(RES, d, "splash.png");
  try {
    if (!statSync(p).isFile()) continue;
    const m = await sharp(p).metadata();
    console.log(
      `${d.padEnd(46)}${(m.width + "x" + m.height).padEnd(12)}${(m.width / m.height).toFixed(3)}`,
    );
  } catch {
    /* not every drawable dir has a splash.png */
  }
}

console.log(`\nthis device screen: 1080x2220  aspect 1080/2220 = ${(1080 / 2220).toFixed(3)}`);
console.log(`true logo aspect : 636/607 = ${(636 / 607).toFixed(3)}  (nearly square)`);
