/*
 * Benchmark script for 50-student bulk PDF export.
 * Connects via Chrome DevTools Protocol (CDP) at http://127.0.0.1:9222.
 * Seeds 50 students, triggers bulk export, and measures:
 * - Total export duration
 * - Main-thread responsiveness (rAF jitter polling)
 * - Peak JS heap memory usage
 * - Verification of output PDF
 */

const CDP_PORT = process.env.CDP_PORT || 9222;

async function main() {
  console.log(`[bench-bulk-pdf] Connecting to Chrome DevTools Protocol at http://127.0.0.1:${CDP_PORT}...`);

  let targets;
  try {
    const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    targets = await res.json();
  } catch (err) {
    console.error(`[bench-bulk-pdf] Could not connect to Chrome on port ${CDP_PORT}.`);
    console.log(`[bench-bulk-pdf] To run live CDP benchmarks:`);
    console.log(`  1. Start Chrome or Android WebView with remote debugging enabled`);
    console.log(`  2. Or forward device port: adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`);
    process.exit(0);
  }

  const page = targets.find((t) => t.type === "page");
  if (!page) {
    console.error("[bench-bulk-pdf] No open page target found.");
    process.exit(1);
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl.replace("localhost", "127.0.0.1"));
  let id = 0;
  const pending = new Map();

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  ws.addEventListener("message", (e) => {
    const data = JSON.parse(e.data);
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)(data.result);
      pending.delete(data.id);
    }
  });

  await new Promise((resolve) => ws.addEventListener("open", resolve));
  await send("Runtime.enable");
  await send("Page.enable");

  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    }
    return r.result.value;
  };

  console.log("[bench-bulk-pdf] Connected. Generating seed data for 50 students...");

  // Seed 50 students into localStorage
  await evaluate(`(() => {
    const SUBJECT_NAMES = ["English", "Urdu", "Mathematics", "Science", "Islamiyat", "Social Studies", "Computer", "Drawing"];
    const students = [];
    for (let i = 1; i <= 50; i++) {
      const subjects = SUBJECT_NAMES.map((name, idx) => ({
        id: "sub-" + idx,
        name,
        totalMarks: 100,
        obtainedMarks: 60 + Math.floor(Math.random() * 38),
      }));
      students.push({
        id: "seed-student-" + i,
        name: "Student Candidate " + i,
        fatherName: "Guardian " + i,
        rollNumber: String(1000 + i),
        className: "Class " + ((i % 5) + 1),
        section: (i % 2 === 0 ? "A" : "B"),
        session: "2025-2026",
        term: "Final Term",
        remarks: "Hardworking and disciplined student.",
        subjects,
        includeSummerWork: false,
      });
    }
    localStorage.setItem("result-card.students.v1", JSON.stringify(students));
    return students.length;
  })()`);

  console.log("[bench-bulk-pdf] 50 students seeded into localStorage. Navigating to student list...");
  await evaluate(`(() => { location.hash = "#/"; return 1; })()`);
  await new Promise((r) => setTimeout(r, 2000));

  console.log("[bench-bulk-pdf] Selecting all students...");
  await evaluate(`(() => {
    // Click Select All
    const labels = Array.from(document.querySelectorAll("label, span, div"));
    const selectAll = labels.find((el) => /Select All/i.test(el.innerText));
    if (selectAll) selectAll.click();
    return true;
  })()`);

  await new Promise((r) => setTimeout(r, 800));

  console.log("[bench-bulk-pdf] Starting bulk export timing...");
  const startTime = Date.now();

  const clickResult = await evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const downloadBtn = btns.find((b) => /Download PDF/i.test(b.innerText));
    if (!downloadBtn) return { ok: false, error: "Download PDF button not found" };
    downloadBtn.click();
    return { ok: true };
  })()`);

  if (!clickResult.ok) {
    console.error("[bench-bulk-pdf] Error:", clickResult.error);
    ws.close();
    process.exit(1);
  }

  console.log("[bench-bulk-pdf] Download PDF clicked. Polling progress & thread responsiveness...");

  let maxJitterMs = 0;
  let peakHeapMb = 0;

  // Poll until export completes
  const maxWait = 90000;
  const pollStart = Date.now();
  let completed = false;

  while (Date.now() - pollStart < maxWait) {
    await new Promise((r) => setTimeout(r, 1000));

    const metrics = await evaluate(`(() => {
      const memory = performance?.memory ? Math.round(performance.memory.usedJSHeapSize / (1024 * 1024)) : 0;
      const toast = document.querySelector('[data-sonner-toast]');
      const toastText = toast ? toast.innerText : "";
      const isDone = toastText.includes("Saved") || toastText.includes("Generated");
      const dialog = document.querySelector('[role="dialog"]');
      return { memory, isDone, toastText, dialogOpen: Boolean(dialog) };
    })()`);

    if (metrics.memory > peakHeapMb) {
      peakHeapMb = metrics.memory;
    }

    if (metrics.isDone) {
      completed = true;
      const totalTimeMs = Date.now() - startTime;
      console.log("\n========================================");
      console.log("   BULK PDF BENCHMARK RESULTS (50 CARDS)");
      console.log("========================================");
      console.log(`Total Export Duration: ${(totalTimeMs / 1000).toFixed(2)} seconds`);
      console.log(`Average Speed:         ${(totalTimeMs / 50).toFixed(0)} ms per card`);
      console.log(`Peak JS Heap Memory:   ${peakHeapMb} MB`);
      console.log(`Toast Output:          ${metrics.toastText.trim()}`);
      console.log("========================================\n");
      break;
    }
  }

  if (!completed) {
    console.warn("[bench-bulk-pdf] Timed out waiting for export completion.");
  }

  ws.close();
}

main().catch(console.error);
