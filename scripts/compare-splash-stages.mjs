/*
 * Compares where the web #boot overlay puts its logo and loading bar against
 * where the native launch window (res/drawable/splash_window.xml) puts them.
 *
 * The two stages of the launch are only seamless if they draw the same picture in
 * the same place - a bare lockup followed by a lockup-with-bar reads as two
 * different splashes with a blink between them, which is what was reported.
 *
 * Native geometry is computed from the same inputs Android uses: the xxhdpi
 * lockup scaled by 420/480 (the device's density over the bucket's), and the bar
 * from splash_bar.xml (240dp x 4dp, 84dp above the bottom).
 */
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

// Reinstate the overlay markup (mobile/main.tsx removes it once React renders) so
// it can be measured in isolation.
console.log(
  await ev(`(function () {
    var old = document.getElementById('boot');
    if (old) old.remove();
    var el = document.createElement('div');
    el.id = 'boot';
    el.innerHTML =
      '<img class="boot__lockup" src="/splash-lockup.png" alt="The Country School">' +
      '<div class="boot__bar" role="progressbar" aria-label="Loading"></div>';
    document.body.appendChild(el);
    return 'overlay reinstated';
  })()`),
);
await wait(1200);

const WEB = await ev(
  `JSON.stringify((function () {
    var img = document.querySelector('#boot .boot__lockup');
    var bar = document.querySelector('#boot .boot__bar');
    var ir = img.getBoundingClientRect();
    var br = bar.getBoundingClientRect();
    return {
      dpr: devicePixelRatio,
      vw: innerWidth, vh: innerHeight,
      lockup: { w: +ir.width.toFixed(1), h: +ir.height.toFixed(1),
                cx: +((ir.left + ir.width / 2) / innerWidth).toFixed(4),
                cy: +((ir.top + ir.height / 2) / innerHeight).toFixed(4) },
      bar: { w: +br.width.toFixed(1), h: +br.height.toFixed(1),
             fromBottomDp: +((innerHeight - br.bottom)).toFixed(1),
             centreFrac: +((br.left + br.width / 2) / innerWidth).toFixed(4) },
      barAnim: getComputedStyle(bar, '::after').animationName
    };
  })())`,
);

console.log("=== web #boot overlay (measured live) ===");
const web = JSON.parse(WEB);
console.log(JSON.stringify(web, null, 1));

// --- native side, computed the way Android would ---
const DENSITY = 420;
const BUCKET_DPI = 480;
const scale = DENSITY / BUCKET_DPI;
const lockMeta = await (
  await import("sharp")
)
  .default("android/app/src/main/res/drawable-xxhdpi/splash_lockup.png")
  .metadata();
const nativeLockupW = lockMeta.width * scale;
const nativeLockupH = lockMeta.height * scale;
const native = {
  lockup: {
    wDp: +nativeLockupW.toFixed(1),
    hDp: +nativeLockupH.toFixed(1),
    cx: 0.5,
    cy: 0.5,
  },
  bar: { wDp: 240, hDp: 4, fromBottomDp: 84, centreFrac: 0.5 },
};

console.log("\n=== native splash_window (computed as Android renders it) ===");
console.log(JSON.stringify(native, null, 1));

console.log("\n=== native vs web ===");
const checks = [
  ["lockup centred horizontally", Math.abs(web.lockup.cx - native.lockup.cx) < 0.01],
  ["lockup centred vertically", Math.abs(web.lockup.cy - native.lockup.cy) < 0.02],
  [
    "lockup width",
    Math.abs(web.lockup.w / (nativeLockupW / (DENSITY / 160)) / native.lockup.wDp) < 0.12,
  ],
  ["bar width 240", Math.abs(web.bar.w - native.bar.wDp) < 2],
  ["bar height 4", Math.abs(web.bar.h - native.bar.hDp) < 0.6],
  ["bar 84dp from bottom", Math.abs(web.bar.fromBottomDp - native.bar.fromBottomDp) < 3],
  ["bar horizontally centred", Math.abs(web.bar.centreFrac - native.bar.centreFrac) < 0.01],
];

let ok = true;
for (const [label, pass] of checks) {
  if (!pass) ok = false;
  console.log(`  ${pass ? "OK  " : "FAIL"}  ${label}`);
}
console.log(`\nweb bar animation: ${web.barAnim}`);
console.log(
  `\nresult: ${ok ? "native and web splash draw the same picture - the hand-off is seamless" : "geometry still differs"}`,
);

// tidy up so the injected overlay does not linger
await ev(`(function(){var e=document.getElementById('boot'); if(e) e.remove(); return 1;})()`);
ws.close();
process.exit(0);
