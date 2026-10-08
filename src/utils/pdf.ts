import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { PAGE_HEIGHT_MM, PAGE_WIDTH_MM, PX_PER_MM } from "@/lib/cardGeometry";

/** One rendered page: the bitmap plus the pixel size it was rasterised at. */
interface RenderedPage {
  dataUrl: string;
  width: number;
  height: number;
}

export interface RenderElementOptions {
  scale?: number;
  quality?: number;
}

export type PdfPhase = "rendering" | "finalising" | "saving";

export interface PdfProgress {
  phase: PdfPhase;
  current: number;
  total: number;
  percent: number;
  label: string;
}

export class PdfCancelledError extends Error {
  constructor(message = "PDF export was cancelled") {
    super(message);
    this.name = "PdfCancelledError";
  }
}

/**
 * Ensure document fonts are loaded once outside the render loop
 * to prevent awaiting redundant font promises on every single card.
 */
export async function ensureFontsLoaded(): Promise<void> {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font readiness errors to prevent blocking export
    }
  }
}

/**
 * Renders an A4 element into a crisp canvas image.
 * Bypasses cloneNode when the element is already unscaled (e.g. bulk export offscreen container),
 * uses a strict 150ms image decode timeout to prevent hanging,
 * and injects a single CSS stylesheet into the clone to avoid hundreds of style mutations.
 */
async function renderElement(
  element: HTMLElement,
  options?: RenderElementOptions,
): Promise<RenderedPage> {
  // Use an isolated iframe so html2canvas only processes this single card (~150 DOM nodes)
  // instead of scanning the entire application (4,000+ table/button DOM nodes).
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "0px";
  iframe.style.top = "0px";
  iframe.style.width = `${PAGE_WIDTH_MM}mm`;
  iframe.style.minHeight = `${PAGE_HEIGHT_MM}mm`;
  iframe.style.zIndex = "-99999";
  iframe.style.opacity = "0.01";
  iframe.style.pointerEvents = "none";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) throw new Error("Could not create rendering iframe context");

  // Copy stylesheets into the isolated iframe
  for (const sheet of document.querySelectorAll("link[rel='stylesheet'], style")) {
    doc.head.appendChild(sheet.cloneNode(true));
  }

  // Clone the node into the isolated iframe body
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.transform = "none";
  clone.style.width = `${PAGE_WIDTH_MM}mm`;
  clone.style.minHeight = `${PAGE_HEIGHT_MM}mm`;
  clone.style.boxSizing = "border-box";
  clone.style.margin = "0";

  doc.body.style.margin = "0";
  doc.body.style.padding = "0";
  doc.body.style.background = "#ffffff";
  doc.body.appendChild(clone);

  try {
    const t0 = performance.now();
    // Wait for any pending images with a strict 150ms timeout so slow/offscreen decodes never hang
    const imgPromises = Array.from(clone.querySelectorAll("img")).map((img) =>
      img.complete ? Promise.resolve() : img.decode().catch(() => undefined),
    );
    await Promise.race([
      Promise.all(imgPromises),
      new Promise((resolve) => setTimeout(resolve, 150)),
    ]);
    const tImg = performance.now() - t0;

    const scale = options?.scale ?? (isNativeApp() ? 1.5 : 1.8);
    const quality = options?.quality ?? 0.88;

    const tCanvas0 = performance.now();
    const canvas = await html2canvas(clone, {
      scale,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      width: PAGE_WIDTH_MM * PX_PER_MM,
      windowWidth: 1200,
      x: 0,
      y: 0,
      onclone: (clonedDoc) => {
        // Fast instant style injection instead of iterating hundreds of DOM nodes
        const style = clonedDoc.createElement("style");
        style.textContent = `
          [data-result-card], [data-result-card] * {
            letter-spacing: 0px !important;
            word-spacing: normal !important;
            transform: none !important;
            opacity: 1 !important;
          }
        `;
        clonedDoc.head.appendChild(style);
      },
    });
    const tCanvas = performance.now() - tCanvas0;

    const tData0 = performance.now();
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const tData = performance.now() - tData0;

    const width = canvas.width;
    const height = canvas.height;

    // Immediately zero out canvas dimensions to release underlying GPU texture buffer
    canvas.width = 0;
    canvas.height = 0;

    console.log(`[PERF_CARD] img=${Math.round(tImg)}ms h2c=${Math.round(tCanvas)}ms toDataURL=${Math.round(tData)}ms total=${Math.round(performance.now() - t0)}ms`);

    return {
      dataUrl,
      width,
      height,
    };
  } finally {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }
}

/**
 * Places a rendered card on the page without distorting it.
 */
function addPageImage(pdf: jsPDF, page: RenderedPage) {
  const widthFittedHeightMm = (PAGE_WIDTH_MM * page.height) / page.width;
  const drawW =
    widthFittedHeightMm <= PAGE_HEIGHT_MM
      ? PAGE_WIDTH_MM
      : (PAGE_HEIGHT_MM * page.width) / page.height;
  const drawH = widthFittedHeightMm <= PAGE_HEIGHT_MM ? widthFittedHeightMm : PAGE_HEIGHT_MM;

  pdf.addImage(
    page.dataUrl,
    "JPEG",
    (PAGE_WIDTH_MM - drawW) / 2,
    (PAGE_HEIGHT_MM - drawH) / 2,
    drawW,
    drawH,
    undefined,
    "FAST",
  );
}

const NATIVE_PDF_DIR = "ResultCard";
const PUBLIC_DOWNLOADS_DIR = "Download";

export interface PdfSaveResult {
  native: boolean;
  location?: string;
  inDownloads?: boolean;
}

interface CapacitorNativeGlobal {
  Capacitor?: { isNativePlatform?: () => boolean };
}

export function isNativeApp(): boolean {
  const native = (window as unknown as CapacitorNativeGlobal).Capacitor;
  return typeof window !== "undefined" && Boolean(native?.isNativePlatform?.());
}

/**
 * Linear, non-blocking base64 encoder.
 * Uses native C++ FileReader when available to avoid JS heap spikes,
 * with an async chunked fallback that yields to the event loop.
 */
async function toBase64(buffer: ArrayBuffer, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) throw new PdfCancelledError("Cancelled before base64 encoding");

  if (typeof Blob !== "undefined" && typeof FileReader !== "undefined") {
    return new Promise((resolve, reject) => {
      const blob = new Blob([buffer], { type: "application/pdf" });
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        const comma = res.indexOf(",");
        resolve(comma !== -1 ? res.substring(comma + 1) : res);
      };
      reader.onerror = () => reject(new Error("Failed to convert buffer to base64"));
      reader.readAsDataURL(blob);
    });
  }

  // Linear fallback: typed array slice directly into String.fromCharCode without Array.from
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x7fe0; // 32736, multiple of 3
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    if (signal?.aborted) throw new PdfCancelledError("Cancelled during base64 encoding");
    const slice = bytes.subarray(offset, Math.min(offset + CHUNK, bytes.length));
    chunks.push(btoa(String.fromCharCode.apply(null, slice as unknown as number[])));
    if ((offset / CHUNK) % 20 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  return chunks.join("");
}

function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "-").trim();
}

function displayPath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ""));
}

async function writeToDownloads(name: string, base64: string): Promise<string | null> {
  let storage = (await Filesystem.checkPermissions()).publicStorage;
  if (storage !== "granted") {
    storage = (await Filesystem.requestPermissions()).publicStorage;
  }
  if (storage !== "granted") return null;

  try {
    const { uri } = await Filesystem.writeFile({
      path: `${PUBLIC_DOWNLOADS_DIR}/${name}`,
      data: base64,
      directory: Directory.ExternalStorage,
      recursive: true,
    });
    return uri;
  } catch (error) {
    console.warn("Could not write the PDF to Download/:", error);
    return null;
  }
}

async function savePdfNatively(
  pdf: jsPDF,
  fileName: string,
  signal?: AbortSignal,
): Promise<PdfSaveResult> {
  if (signal?.aborted) throw new PdfCancelledError();
  const name = safeFileName(fileName);
  const base64 = await toBase64(pdf.output("arraybuffer"), signal);

  if (signal?.aborted) throw new PdfCancelledError();
  const downloadUri = await writeToDownloads(name, base64);
  if (downloadUri) {
    return { native: true, location: displayPath(downloadUri), inDownloads: true };
  }

  if (signal?.aborted) throw new PdfCancelledError();
  const { uri } = await Filesystem.writeFile({
    path: `${NATIVE_PDF_DIR}/${name}`,
    data: base64,
    directory: Directory.External,
    recursive: true,
  });

  if ((await Share.canShare()).value) {
    try {
      await Share.share({
        title: name,
        dialogTitle: "Save or share result card",
        files: [uri],
      });
    } catch (error) {
      console.warn("PDF share sheet could not open:", error);
    }
  }

  return { native: true, location: displayPath(uri), inDownloads: false };
}

export interface GeneratePdfFromSourceOptions {
  total: number;
  fileName: string;
  resolveElement: (index: number) => Promise<HTMLElement | null>;
  onProgress?: (progress: PdfProgress) => void;
  signal?: AbortSignal;
  scale?: number;
  quality?: number;
}

/**
 * Primary core PDF generation engine with lazy element resolution,
 * weighted monotonic progress phases, and responsive cancellation.
 *
 * Progress Weighting:
 * - Rendering:  0% -> 88%
 * - Finalising: 88% -> 94%
 * - Saving:     94% -> 100%
 */
export async function generatePdfFromSource(
  options: GeneratePdfFromSourceOptions,
): Promise<PdfSaveResult | undefined> {
  const { total, fileName, resolveElement, onProgress, signal, scale, quality } = options;
  if (total <= 0) return;

  await ensureFontsLoaded();

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: false, // compress: false prevents wasteful flate re-compression of JPEG streams
  });

  // Phase 1: Rendering (0% to 88%)
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) throw new PdfCancelledError();

    const percent = Math.max(1, Math.round((i / total) * 88));
    onProgress?.({
      phase: "rendering",
      current: i + 1,
      total,
      percent,
      label: `Rendering card ${i + 1} of ${total}...`,
    });

    const el = await resolveElement(i);
    if (!el) {
      throw new Error(`Failed to resolve element for student index ${i}`);
    }

    if (signal?.aborted) throw new PdfCancelledError();

    const page = await renderElement(el, { scale, quality });
    if (i > 0) pdf.addPage("a4", "portrait");
    addPageImage(pdf, page);

    // Yield control to event loop so animations & touches stay smooth
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  if (signal?.aborted) throw new PdfCancelledError();

  // Phase 2: Finalising (88% to 94%)
  onProgress?.({
    phase: "finalising",
    current: total,
    total,
    percent: 90,
    label: "Finalising PDF...",
  });

  // Short tick to allow UI to paint finalising state
  await new Promise((resolve) => setTimeout(resolve, 20));

  // Phase 3: Saving (94% to 100%)
  onProgress?.({
    phase: "saving",
    current: total,
    total,
    percent: 95,
    label: "Saving to Downloads...",
  });

  let result: PdfSaveResult | undefined;
  if (isNativeApp()) {
    result = await savePdfNatively(pdf, fileName, signal);
  } else {
    pdf.save(fileName);
    result = { native: false };
  }

  onProgress?.({
    phase: "saving",
    current: total,
    total,
    percent: 100,
    label: "Export complete",
  });

  return result;
}

/**
 * Backward-compatible thin wrapper over generatePdfFromSource.
 * Existing callers (editor.$studentId.tsx & handleDirectPdf) remain 100% compatible.
 */
export async function generatePdf(
  elements: HTMLElement[],
  fileName: string,
  onProgress?: (current: number, total: number) => void,
  options?: { signal?: AbortSignal; scale?: number; quality?: number },
): Promise<PdfSaveResult | undefined> {
  return generatePdfFromSource({
    total: elements.length,
    fileName,
    resolveElement: async (i) => elements[i] ?? null,
    onProgress: onProgress
      ? (p) => onProgress(p.current, p.total)
      : undefined,
    signal: options?.signal,
    scale: options?.scale,
    quality: options?.quality,
  });
}

export interface BulkGenerateOptions {
  fileName: string;
  total: number;
  studentNames?: string[];
  getCardElement: (index: number) => Promise<HTMLElement | null>;
  onCardProcessed?: (index: number) => Promise<void> | void;
  onProgress?: (progress: {
    current: number;
    total: number;
    percent: number;
    stage: "rendering" | "building" | "saving" | "done";
    studentName?: string;
  }) => void;
  signal?: AbortSignal;
}

/**
 * Backward compatibility alias for sequential bulk generation.
 */
export async function generateBulkPdfSequentially(
  options: BulkGenerateOptions,
): Promise<PdfSaveResult | undefined> {
  const { fileName, total, studentNames, getCardElement, onCardProcessed, onProgress, signal } =
    options;

  return generatePdfFromSource({
    total,
    fileName,
    resolveElement: async (i) => {
      const el = await getCardElement(i);
      if (onCardProcessed) {
        // Allow caller to clean up previous card if needed
        setTimeout(() => onCardProcessed(i), 0);
      }
      return el;
    },
    onProgress: (p) => {
      onProgress?.({
        current: p.current,
        total: p.total,
        percent: p.percent,
        stage: p.phase === "finalising" ? "building" : p.phase,
        studentName: studentNames?.[p.current - 1],
      });
    },
    signal,
  });
}

export interface SharePdfOptions {
  title?: string;
  text?: string;
  dialogTitle?: string;
}

/**
 * Render one or more A4 elements into a PDF and immediately open the native share sheet.
 */
export async function sharePdf(
  elements: HTMLElement[],
  fileName: string,
  options?: SharePdfOptions,
  onProgress?: (current: number, total: number) => void,
): Promise<{ shared: boolean; error?: string }> {
  if (elements.length === 0) return { shared: false, error: "No elements to render" };

  await ensureFontsLoaded();

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: false,
  });

  const total = elements.length;
  const scale = isNativeApp() ? 1.5 : 1.8;
  const quality = 0.88;

  for (let i = 0; i < total; i++) {
    const el = elements[i];
    if (el) {
      if (onProgress) onProgress(i + 1, total);
      const page = await renderElement(el, { scale, quality });
      if (i > 0) pdf.addPage("a4", "portrait");
      addPageImage(pdf, page);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  const name = safeFileName(fileName);
  const base64 = await toBase64(pdf.output("arraybuffer"));

  if (isNativeApp()) {
    const { uri: cacheUri } = await Filesystem.writeFile({
      path: name,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });

    writeToDownloads(name, base64).catch(() => null);

    try {
      await Share.share({
        title: options?.title || name,
        text: options?.text || "The Country School Result Card",
        dialogTitle: options?.dialogTitle || "Send Result Card to Parent via WhatsApp",
        files: [cacheUri],
      });
      return { shared: true };
    } catch (shareErr: unknown) {
      const msg = String((shareErr as Error)?.message || "").toLowerCase();
      if (msg.includes("canceled") || msg.includes("cancelled") || msg.includes("dismissed")) {
        return { shared: true };
      }
      console.warn("Share sheet error:", shareErr);
      return { shared: false, error: (shareErr as Error)?.message };
    }
  }

  if (typeof navigator !== "undefined" && typeof File !== "undefined") {
    try {
      const blob = pdf.output("blob");
      const file = new File([blob], name, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: options?.title || name,
          text: options?.text || "The Country School Result Card",
        });
        return { shared: true };
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") {
        return { shared: true };
      }
    }
  }

  pdf.save(name);
  return { shared: false, error: "Browser downloaded PDF directly" };
}
