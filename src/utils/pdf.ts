import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";
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
 * Render one or more A4 elements into a single multi-page PDF.
 * Supports progress tracking for multi-student bulk generation.
 */
export async function generatePdf(
  elements: HTMLElement[],
  fileName: string,
  onProgress?: (current: number, total: number) => void,
) {
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

  pdf.save(fileName);
}
