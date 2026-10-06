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

/**
 * Renders an A4 element into a crisp canvas image.
 * Uses an isolated, unscaled clone container to prevent CSS transform: scale()
 * from distorting text coordinates and letter kerning.
 */
async function renderElement(element: HTMLElement): Promise<RenderedPage> {
  // Create an unscaled isolated container attached directly to the body.
  // Sized in millimetres, not pixels, so the capture box is the A4 sheet exactly:
  // 794x1123px is 209.9x297.1mm, and asking for it that way is how the export
  // used to be skewed.
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
    // Wait for fonts to be fully loaded
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    /*
     * html2canvas rasterises whatever the browser has painted, so a photo that
     * has not finished decoding would be captured blank. The fixed tick below
     * is not a reliable substitute, so wait on decode() explicitly.
     */
    await Promise.all(
      Array.from(clone.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined)),
    );

    // Short tick to allow DOM layout to settle
    await new Promise((resolve) => setTimeout(resolve, 80));

    /*
     * Crop to the card's own box, which is the A4 sheet. `height` is left unset
     * on purpose: if the content ever outgrows the sheet, the canvas grows with
     * it and is scaled down on the way onto the page, whereas an explicit height
     * would hard-crop the signature block off the bottom. The card's own fit
     * engine keeps the content inside the sheet in the first place, so this is a
     * safety net rather than the normal path.
     */
    const canvas = await html2canvas(clone, {
      scale: 2, // 300 DPI high-resolution output
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      width: PAGE_WIDTH_MM * PX_PER_MM,
      windowWidth: 1200,
      x: 0,
      y: 0,
      onclone: (clonedDoc) => {
        // Enforce 0px letter spacing on all text in the clone to completely avoid word/character overlap
        const allElements = clonedDoc.querySelectorAll<HTMLElement>("*");
        allElements.forEach((el) => {
          el.style.letterSpacing = "0px";
          el.style.wordSpacing = "normal";
          el.style.transform = "none";
        });
      },
    });

    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.98),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Places a rendered card on the page without distorting it.
 *
 * html2canvas can only produce a canvas with whole-pixel dimensions, so the
 * bitmap of an exact A4 card comes out 1587x2246 rather than 1587.4x2245.0 -
 * about 0.07% off the page's aspect. Stretching that onto 210x297mm would
 * squeeze the card horizontally, so the bitmap is instead placed at its own
 * aspect and centred. The rounding error then lands where it is harmless: a
 * white band of at most a quarter of a millimetre on one edge, which is an
 * order of magnitude inside the printer's unprintable band.
 *
 * Scaling is uniform either way, so the frame keeps the same distance from the
 * paper on all four sides.
 */
function addPageImage(pdf: jsPDF, page: RenderedPage) {
  // Uniform scale, largest that fits: fit the width first, and only fall back to
  // fitting the height if the bitmap is proportionally taller than the sheet.
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

/**
 * Sub-folder that native PDF writes fall back to.
 *
 * `Directory.External` resolves to the app-specific external files dir
 * (`/storage/emulated/0/Android/data/<pkg>/files/`), so it needs no runtime
 * storage permission on any Android version. Used only when the public
 * `Download/` folder is not writable.
 */
const NATIVE_PDF_DIR = "ResultCard";

/**
 * Folder inside external storage that Android exposes as the user-facing
 * "Downloads" location, written via `Directory.ExternalStorage`.
 */
const PUBLIC_DOWNLOADS_DIR = "Download";

/**
 * Where the generated PDF ended up after being handed to the platform.
 *
 * Browsers download through `<a download>` and can only report success, whereas
 * the native layer writes the file itself and therefore knows the real
 * destination.
 */
export interface PdfSaveResult {
  /** True when the native Android layer wrote the file instead of the browser. */
  native: boolean;
  /** Human readable destination to show the user. Native only. */
  location?: string;
  /**
   * True when the file reached the public `Download/` folder. False means the
   * platform refused and the file fell back to the app's own folder.
   */
  inDownloads?: boolean;
}

/** Minimal shape of the native bridge global that Capacitor injects. */
interface CapacitorNativeGlobal {
  Capacitor?: { isNativePlatform?: () => boolean };
}

/**
 * True when running inside the Capacitor WebView rather than a normal browser.
 *
 * Mirrors the check in `src/router.tsx` so the PDF path agrees with the rest of
 * the app about what counts as "native".
 */
function isNativeApp(): boolean {
  const native = (window as unknown as CapacitorNativeGlobal).Capacitor;
  return typeof window !== "undefined" && Boolean(native?.isNativePlatform?.());
}

/**
 * Base64-encode an ArrayBuffer one slice at a time.
 *
 * `btoa` only accepts an argument list bounded by the JS engine, so a multi-
 * megabyte PDF has to be encoded in slices rather than in one shot. The slice
 * size is deliberately a multiple of 3: `btoa` pads each call independently,
 * so a slice whose length is not divisible by 3 would contribute `=` characters
 * in the *middle* of the joined string and produce malformed base64, which the
 * native filesystem plugin rejects as invalid input.
 */
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x7fe0; // 32736, a multiple of 3
  let base64 = "";
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    base64 += btoa(
      String.fromCharCode.apply(null, Array.from(bytes.subarray(offset, offset + CHUNK))),
    );
  }
  return base64;
}

/**
 * Replace characters that are illegal in file names, so a student name can never
 * make the native write fail.
 */
function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "-").trim();
}

/**
 * Turn a `file:///...` URI into a plain path that reads better in a toast.
 */
function displayPath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ""));
}

/**
 * Write the PDF into the device's public `Download/` folder.
 *
 * Returns the file URI, or `null` when the platform will not allow it. Writing
 * there is a privileged operation: Android 9 and 10 need a runtime
 * `WRITE_EXTERNAL_STORAGE` grant, and from Android 11 the permission is no
 * longer grantable at all, so callers must be prepared to fall back.
 */
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

/**
 * Write the PDF natively and put it in the public `Download/` folder.
 *
 * `jsPDF.save()` cannot work in the WebView: it builds a `blob:` URL and clicks
 * a hidden `<a download>`, and Android's WebView discards that unless the
 * WebView has a `DownloadListener` attached. Capacitor never installs one and
 * no filesystem plugin was registered, so the download reported
 * `state: "canceled"` with 0 bytes written while `save()` itself did not throw,
 * making the failure look like a successful no-op. Writing the file natively is
 * the supported replacement.
 *
 * If the platform refuses to write to `Download/` the file is still saved into
 * the app's own folder and offered through the Android share sheet, so the
 * export always produces something the user can reach.
 */
async function savePdfNatively(pdf: jsPDF, fileName: string): Promise<PdfSaveResult> {
  const name = safeFileName(fileName);
  const base64 = toBase64(pdf.output("arraybuffer"));

  const downloadUri = await writeToDownloads(name, base64);
  if (downloadUri) {
    return { native: true, location: displayPath(downloadUri), inDownloads: true };
  }

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
      // The file is already safely on disk; a share-sheet failure must not be
      // reported as a failed export.
      console.warn("PDF share sheet could not open:", error);
    }
  }

  return { native: true, location: displayPath(uri), inDownloads: false };
}

/**
 * Render one or more A4 elements into a single multi-page PDF.
 * Supports progress tracking for multi-student bulk generation.
 */
export async function generatePdf(
  elements: HTMLElement[],
  fileName: string,
  onProgress?: (current: number, total: number) => void,
): Promise<PdfSaveResult | undefined> {
  if (elements.length === 0) return;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const total = elements.length;

  for (let i = 0; i < total; i++) {
    const el = elements[i];
    if (el) {
      if (onProgress) onProgress(i + 1, total);
      const page = await renderElement(el);
      if (i > 0) pdf.addPage("a4", "portrait");
      /*
       * Full-bleed: the captured image *is* the card, and the card is the A4
       * sheet, so it maps onto the page at 0,0 with no margin of jsPDF's own.
       * All the printer safety lives inside the card, in the frame inset - the
       * PDF page itself stays exactly 210x297mm.
       */
      addPageImage(pdf, page);
    }
  }

  if (isNativeApp()) return await savePdfNatively(pdf, fileName);

  pdf.save(fileName);
  return { native: false };
}

export interface SharePdfOptions {
  title?: string;
  text?: string;
  dialogTitle?: string;
}

/**
 * Render one or more A4 elements into a PDF and immediately open the native share sheet
 * (WhatsApp, Email, Drive, etc.) with the PDF document pre-attached.
 */
export async function sharePdf(
  elements: HTMLElement[],
  fileName: string,
  options?: SharePdfOptions,
  onProgress?: (current: number, total: number) => void,
): Promise<{ shared: boolean; error?: string }> {
  if (elements.length === 0) return { shared: false, error: "No elements to render" };

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const total = elements.length;

  for (let i = 0; i < total; i++) {
    const el = elements[i];
    if (el) {
      if (onProgress) onProgress(i + 1, total);
      const page = await renderElement(el);
      if (i > 0) pdf.addPage("a4", "portrait");
      addPageImage(pdf, page);
    }
  }

  const name = safeFileName(fileName);
  const base64 = toBase64(pdf.output("arraybuffer"));

  if (isNativeApp()) {
    // 1. Write PDF to Cache directory so it is directly sharable via FileProvider
    const { uri: cacheUri } = await Filesystem.writeFile({
      path: name,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });

    // 2. Also save to Downloads in background so a permanent copy is kept
    writeToDownloads(name, base64).catch(() => null);

    // 3. Open native Android share sheet with file attached
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

  // Web fallback: Check if navigator.canShare supports files
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

  // Desktop browser fallback: download the PDF directly
  pdf.save(name);
  return { shared: false, error: "Browser downloaded PDF directly" };
}
