/*
 * Screenshots the live web #boot overlay at full opacity so it can be diffed
 * against the composed native launch window (render-native-splash.mjs).
 *
 * main.tsx removes #boot once the router renders and the app boots in ~200ms, so
 * the overlay is reinstated here with the same markup and given a moment to decode
 * before the shot.
 */
import { writeFileSync } from "node:fs";

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
    var img = el.querySelector('.boot__lockup');
    return 'reinstated, img complete=' + img.complete;
  })()`),
);

await wait(1500);
console.log(
  await ev(
    `JSON.stringify((function(){var i=document.querySelector('#boot .boot__lockup');return {complete:i.complete,naturalW:i.naturalWidth};})())`,
  ),
);

const shot = await send("Page.captureScreenshot", { format: "png" });
const out = "C:/Users/MAAN/AppData/Local/Temp/opencode/web-overlay-full.png";
writeFileSync(out, Buffer.from(shot.data, "base64"));
console.log(`saved ${out}`);

await ev(`(function(){var e=document.getElementById('boot'); if(e) e.remove(); return 1;})()`);
ws.close();
process.exit(0);
