/*
 * Drives the PDF export the way a user would: navigate to a student's editor on
 * the mobile viewport, then tap Download PDF in the bottom action bar, and report
 * what landed on disk.
 *
 * Navigating first matters - the bar on the students list and on settings has no
 * Download PDF button, so triggering without moving to the editor silently does
 * nothing.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const STUDENT = process.argv[2] ?? "t2";

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

// 1. go to the editor on a phone-sized viewport
await send("Emulation.setDeviceMetricsOverride", {
  width: 411,
  height: 807,
  deviceScaleFactor: 2.625,
  mobile: true,
});
await wait(600);
await ev(`(() => { location.hash = "#/editor/${STUDENT}"; return 1; })()`);
await wait(3500);
console.log("route: " + (await ev("location.hash")));

const btn = await ev(`(function () {
  var bar = document.querySelector('.bottom-bar');
  if (!bar) return { ok: false, why: 'no bottom bar' };
  var b = Array.prototype.slice.call(bar.querySelectorAll('button')).filter(function (e) {
    return /Download PDF/.test(e.innerText);
  })[0];
  if (!b) return { ok: false, why: 'no Download PDF button; bar text = ' + bar.innerText.replace(/\\n/g, ' | ') };
  var r = b.getBoundingClientRect();
  b.click();
  return { ok: true, size: Math.round(r.width) + 'x' + Math.round(r.height), label: b.innerText.trim() };
})()`);
console.log("button: " + JSON.stringify(btn));
if (!btn.ok) {
  console.log("RESULT: FAILED - " + btn.why);
  ws.close();
  process.exit(1);
}

// 2. capture the bar mid-export to prove it stays put, then wait for completion
await wait(1200);
console.log(
  "during export: " +
    (await ev(`JSON.stringify((function () {
      var bar = document.querySelector('.bottom-bar');
      var r = bar.getBoundingClientRect();
      var busy = Array.prototype.slice.call(bar.querySelectorAll('button')).map(function (b) { return b.innerText.trim(); });
      return { pinned: Math.abs(r.bottom - innerHeight) <= 1, buttons: busy };
    })())`)),
);

await wait(16000);
console.log(
  "after export: " +
    (await ev(`JSON.stringify((function () {
      var t = document.querySelector('[data-sonner-toast]');
      var bar = document.querySelector('.bottom-bar');
      var r = bar.getBoundingClientRect();
      return { toast: t ? t.innerText.replace(/\\n/g, ' ').slice(0, 90) : null, pinned: Math.abs(r.bottom - innerHeight) <= 1 };
    })())`)),
);

// 3. screenshot whatever is on screen for the record
const shot = await send("Page.captureScreenshot", { format: "png" });
mkdirSync("C:/Users/MAAN/AppData/Local/Temp/opencode", { recursive: true });
writeFileSync(
  "C:/Users/MAAN/AppData/Local/Temp/opencode/after-pdf.png",
  Buffer.from(shot.data, "base64"),
);

await send("Emulation.clearDeviceMetricsOverride");
ws.close();
process.exit(0);
