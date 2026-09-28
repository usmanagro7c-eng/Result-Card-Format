import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

/**
 * Renders an A4 element into a crisp canvas image.
 * Uses an isolated, unscaled clone container to prevent CSS transform: scale()
 * from distorting text coordinates and letter kerning.
 */
async function renderElement(element: HTMLElement): Promise<string> {
  // Create an unscaled isolated container attached directly to the body
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "0px";
  container.style.top = "0px";
  container.style.width = "794px";
  container.style.minHeight = "1123px";
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
  clone.style.width = "794px";
  clone.style.minHeight = "1123px";
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

    const canvas = await html2canvas(clone, {
      scale: 2, // 300 DPI high-resolution output
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      width: 794,
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

    return canvas.toDataURL("image/jpeg", 0.98);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
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
      const image = await renderElement(el);
      if (i > 0) pdf.addPage("a4", "portrait");
      pdf.addImage(image, "JPEG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, undefined, "FAST");
    }
  }

  pdf.save(fileName);
}
