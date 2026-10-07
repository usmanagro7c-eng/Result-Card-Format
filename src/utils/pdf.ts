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
 * Uses an isolated, unscaled clone container to prevent CSS transform: scale()
 * from distorting text coordinates and letter kerning.
 */
async function renderElement(
  element: HTMLElement,
  options?: RenderElementOptions,
): Promise<RenderedPage> {
  // Sized in millimetres, not pixels, so the capture box is the A4 sheet exactly
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "0px";
  container.style.top = "0px";
  container.style.width = `${PAGE_WIDTH_MM}mm`;
  container.style.minHeight = `${PAGE_HEIGHT_MM}mm`;
  container.style.zIndex = "-99999";
  container.style.opacity = "0.01"; // invisible to user but rendered by browser layout engine
  container.style.pointerEvents = "none";
  container.style.background = "#ffffff";
  container.style.transform = "none";
  container.style.margin = "0";
  container.style.padding = "0";

  // Clone the node so parent styles or preview transforms don't affect it
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.transform = "none";
  clone.style.width = `${PAGE_WIDTH_MM}mm`;
  clone.style.minHeight = `${PAGE_HEIGHT_MM}mm`;
  clone.style.boxSizing = "border-box";
  clone.style.margin = "0";

  container.appendChild(clone);
  document.body.appendChild(container);

  try {
    /*
     * html2canvas rasterises whatever the browser has painted, so a photo that
     * has not finished decoding would be captured blank.
     */
    await Promise.all(
      Array.from(clone.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined)),
    );

    // Double-rAF settle: synchronizes DOM layout and styles with browser compositor
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );

    const scale = options?.scale ?? 2; // Default scale 2 (300 DPI high resolution)
    const quality = options?.quality ?? 0.94; // Razor-sharp text, ~50% smaller file size

    const canvas = await html2canvas(clone, {
      scale,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      width: PAGE_WIDTH_MM * PX_PER_MM,
      windowWidth: 1200,
      x: 0,
      y: 0,
      onclone: (_clonedDoc, clonedTarget) => {
        // Scope strictly to the card subtree to avoid scanning the entire cloned document
        const target = (clonedTarget as HTMLElement) || clone;
        const allElements = target.querySelectorAll<HTMLElement>("*");
        allElements.forEach((el) => {
          el.style.letterSpacing = "0px";
          el.style.wordSpacing = "normal";
          el.style.transform = "none";
        });
      },
    });

    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const width = canvas.width;
    const height = canvas.height;

    // Immediately zero out canvas dimensions to release underlying GPU texture buffer
    canvas.width = 0;
    canvas.height = 0;

    return {
      dataUrl,
      width,
      height,
    };
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
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

function isNativeApp(): boolean {
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
  const scale = 2;
  const quality = 0.94;

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
