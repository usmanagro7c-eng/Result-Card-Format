/*
 * Release-build smoke test: walks every route and confirms each renders its own
 * chrome (no crash, no blank route), then exercises the navigation the bottom bar
 * is responsible for.
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
const ev = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails)
    return "__ERR " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

console.log("route".padEnd(22) + "bar    h    pinned  content");
console.log("-".repeat(76));

for (const [route, expect] of [
  ["#/", /Students/],
  ["#/settings", /Settings|Appearance|Logo/],
  ["#/editor/t1", /TOTAL MARKS|Total Marks|Marks/],
  ["#/editor/t2", /TOTAL MARKS|Total Marks|Marks/],
]) {
  await ev(`(() => { location.hash = "${route}"; return 1; })()`);
  await wait(2500);
  const r = await ev(
    `JSON.stringify((function () {
      var bar = document.querySelector('.bottom-bar');
      var rc = bar ? bar.getBoundingClientRect() : null;
      var txt = document.body.innerText;
      return {
        bar: !!bar,
        h: rc ? Math.round(rc.height) : null,
        pinned: rc ? Math.abs(rc.bottom - innerHeight) <= 1 : null,
        notFound: /Student Record Not Found/.test(txt),
        len: txt.length
      };
    })())`,
  );
  const d = JSON.parse(r);
  const contentOk = expect.test(await ev("document.body.innerText")) && d.len > 40 && !d.notFound;
  console.log(
    `${route.padEnd(22)}${(d.bar ? "yes" : "no ").padEnd(7)}${String(d.h ?? "-").padEnd(5)}${String(d.pinned ?? "-").padEnd(8)}${contentOk ? "OK" : "PROBLEM"}`,
  );
}

console.log("\n=== bottom nav taps ===");
await ev(`(() => { location.hash = '#/'; return 1; })()`);
await wait(2200);
console.log(
  await ev(`(function () {
    var bar = document.querySelector('.bottom-bar');
    var links = Array.prototype.slice.call(bar.querySelectorAll('a'));
    var settings = links.filter(function (a) { return /Settings/.test(a.innerText); })[0];
    if (!settings) return 'settings link not found';
    settings.click();
    return 'clicked Settings';
  })()`),
);
await wait(2500);
console.log("  -> route now: " + (await ev("location.hash")));
console.log(
  "  settings rendered: " + (await ev(`/Settings|Appearance|Logo/.test(document.body.innerText)`)),
);

console.log("\n=== editor 'Next' ===");
await ev(`(() => { location.hash = '#/editor/t1'; return 1; })()`);
await wait(2500);
const before = await ev("location.hash");
await ev(`(function () {
  var bar = document.querySelector('.bottom-bar');
  var b = Array.prototype.slice.call(bar.querySelectorAll('button')).filter(function (e) { return /Next/.test(e.innerText); })[0];
  if (!b) return 'no Next';
  b.click();
  return 'clicked';
})()`);
await wait(2500);
const after = await ev("location.hash");
console.log(`  ${before} -> ${after}  ${before !== after ? "OK navigated" : "NO CHANGE"}`);

console.log("\n=== theme sanity (must stay light on a dark-mode device) ===");
console.log(
  await ev(`JSON.stringify({
    prefersDark: matchMedia('(prefers-color-scheme: dark)').matches,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    htmlBg: getComputedStyle(document.documentElement).backgroundColor,
    bootOverlayGone: !document.getElementById('boot')
  }, null, 1)`),
);

ws.close();
process.exit(0);
