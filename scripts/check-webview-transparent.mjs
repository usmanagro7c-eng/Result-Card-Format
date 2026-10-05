/*
 * Confirms a transparent WebView background does not let the launch splash show
 * through into the running app.
 *
 * With android.backgroundColor = "#00000000" the WebView is see-through until the
 * document paints, which is what removes the blank-white stage. The risk is the
 * opposite side of the same trade: once the app is running, any element that is
 * not opaque would expose the window background (white + TCS lockup + bar) behind
 * the UI. So this walks the routes and checks the actual painted pixels, not just
 * the declared styles.
 */
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const t = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const p = t.find((x) => x.type === "page");
const ws = new WebSocket(p.webSocketDebuggerUrl.replace("localhost", "127.0.0.1"));
let id = 0;
const m = new Map();
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id;
    m.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
ws.addEventListener("message", (e) => {
  const d = JSON.parse(e.data);
  if (d.id && m.has(d.id)) {
    m.get(d.id)(d.result);
    m.delete(d.id);
  }
});
await new Promise((r) => ws.addEventListener("open", r));
await send("Runtime.enable");
await send("Page.enable");
const ev = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails)
    return "__ERR " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const ROUTES = ["#/", "#/editor/t1", "#/settings"];

console.log("route".padEnd(16) + "html / body / root declared backgrounds");
console.log("-".repeat(78));
for (const route of ROUTES) {
  await ev(`(() => { location.hash = "${route}"; return 1; })()`);
  await wait(2500);
  const styles = await ev(
    `JSON.stringify((function () {
      var g = function (sel) { var e = document.querySelector(sel); return e ? getComputedStyle(e).backgroundColor : null; };
      return { html: g('html'), body: g('body'), root: g('#root'), main: g('main') };
    })())`,
  );
  console.log(`  ${route.padEnd(14)} ${styles}`);
}

/*
 * Now the decisive check: sample the painted pixels. The splash lockup is a
 * centred ~350x334 block of navy/red. If it were leaking through, a large
 * navy+red cluster would sit in the middle of an otherwise empty page. In a
 * correctly painted app that area holds app content instead, so compare the
 * centre region against the same region of the splash render.
 */
const shot = await send("Page.captureScreenshot", { format: "png" });
const buf = Buffer.from(shot.data, "base64");
const file = "C:/Users/MAAN/AppData/Local/Temp/opencode/app-running.png";
writeFileSync(file, buf);

const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width,
  H = info.height,
  ch = info.channels;

// splash crest occupies roughly the middle third; sample that band only
const y0 = Math.round(H * 0.35),
  y1 = Math.round(H * 0.6);
let navy = 0,
  red = 0,
  px = 0;
for (let y = y0; y < y1; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * ch;
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    px++;
    if (Math.abs(r - 0x28) < 45 && Math.abs(g - 0x24) < 45 && Math.abs(b - 0x6a) < 45) navy++;
    if (Math.abs(r - 0xed) < 45 && Math.abs(g - 0x1c) < 45 && Math.abs(b - 0x23) < 45) red++;
  }
}

// A leak would look like the splash: tens of percent brand coverage in that band.
const brandPct = ((navy + red) / px) * 100;
console.log(`\nscreenshot: ${W}x${H}  (centre band y=${y0}-${y1})`);
console.log(`  navy ${navy}  red ${red}  = ${brandPct.toFixed(2)}% of that band`);
console.log(
  brandPct < 3
    ? "  OK - no splash lockup bleeding through the running app"
    : "  PROBLEM - a large navy/red block is visible; the splash is showing through",
);

ws.close();
process.exit(0);
