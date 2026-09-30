/**
 * A4 sheet geometry for the result card, in millimetres.
 *
 * The card *is* the page: every output path (screen preview, browser print and
 * the html2canvas -> jsPDF export) puts these same 210x297mm on the sheet. So
 * the numbers live here, in one place, and the card derives its whole layout
 * from a single input: how wide a band of the paper the printer cannot print in.
 *
 * Nothing in this file is a style preference. Changing any of it changes what
 * reaches the paper.
 */

/** Sheet size. Fixed: the report format is A4 portrait. */
export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;

/** CSS px per mm at the CSS reference resolution of 96dpi. */
export const PX_PER_MM = 96 / 25.4; // 3.7795275591

/** The sheet height in CSS px. The single number a card is fitted against. */
export const PAGE_HEIGHT_PX = PAGE_HEIGHT_MM * PX_PER_MM; // 1122.52

/**
 * Printer safe margins, as the unprintable band kept clear on all four sides.
 *
 * A desktop printer physically cannot print to the edge of the sheet, and its
 * bottom band is normally the widest of the four. The decorative frame is the
 * outermost ink on the page, so if it lands inside that band the bottom rule
 * simply never reaches the paper even though the file is perfect and the
 * on-screen preview shows the whole card.
 *
 *   10mm  - home and small-office inkjets; the safe default
 *   12.7mm- 0.5in, the traditional office laser / MFP default
 *   15mm  - for unusually wide bands (some borderless-capable MFPs, or a
 *           printer in draft/economic mode)
 */
export const PRINTER_MARGIN_OPTIONS = [
  { value: 10, label: "10 mm - standard (recommended)" },
  { value: 12.7, label: "12.7 mm - office laser (1/2 inch)" },
  { value: 15, label: "15 mm - very wide unprintable band" },
] as const;

export const DEFAULT_PRINTER_MARGIN_MM = 10;

const SUPPORTED_MARGINS = PRINTER_MARGIN_OPTIONS.map((o) => o.value);

/**
 * Coerces a stored/typed value to one of the supported margins.
 *
 * Settings come out of localStorage, so this value can be anything a stale or
 * hand-edited payload contains. An unexpected number must not become a random
 * padding, so unknown input falls back to the default.
 */
export function normalizePrinterMarginMm(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return SUPPORTED_MARGINS.includes(n as (typeof SUPPORTED_MARGINS)[number])
    ? n
    : DEFAULT_PRINTER_MARGIN_MM;
}

/** Gap between the outer frame and the inner hairline. Purely decorative, and
 *  unchanged from the original 7mm / 8.5mm pair, so the frame pair still reads
 *  as one design at every printer margin. */
export const FRAME_STEP_MM = 1.5;

/** Inset of the outer frame, measured from the paper edge. */
export function frameInsetMm(printerMarginMm: number): number {
  return printerMarginMm;
}

/** Inset of the inner hairline. */
export function innerFrameInsetMm(printerMarginMm: number): number {
  return printerMarginMm + FRAME_STEP_MM;
}

/**
 * Root vertical padding.
 *
 * Equal to the printer margin, which is what keeps the visible gap between the
 * hairline and the content constant at *any* margin: the content box always
 * starts at (margin + content padding) and the hairline at (margin + 1.5mm), so
 * the gap is the content padding minus 1.5mm regardless of the printer. Paying
 * for a bigger margin out of this padding is the whole point - the frame moves
 * in without the content crossing it.
 */
export function padYMm(printerMarginMm: number): number {
  return printerMarginMm;
}

/**
 * Root horizontal padding.
 *
 * 12mm is the design value and is kept for the standard margin so a normal card
 * is unchanged. A larger margin has to win, otherwise the hairline would end up
 * outside the content and cross the first column of the table.
 */
export function padXMm(printerMarginMm: number): number {
  return Math.max(12, printerMarginMm + FRAME_STEP_MM);
}

/** Padding of the content block inside the root padding. */
export const CONTENT_PY_MM = 4;
export const CONTENT_PX_MM = 5;

/**
 * How much vertical room the six sections have at a given printer margin.
 *
 * This is the number the card is fitted against, and it is the reason a bigger
 * margin costs content rather than just moving the frame: 269mm at 10mm,
 * 263.6mm at 12.7mm, 259mm at 15mm.
 */
export function contentBudgetMm(printerMarginMm: number): number {
  return PAGE_HEIGHT_MM - 2 * padYMm(printerMarginMm) - 2 * CONTENT_PY_MM;
}

/** The same budget in CSS px, for comparing against a measured element. */
export function contentBudgetPx(printerMarginMm: number): number {
  return contentBudgetMm(printerMarginMm) * PX_PER_MM;
}

/**
 * The gaps the fit engine is allowed to take back, in the order it gives them
 * up: cheapest and least visible first, so a card that is only a little too
 * tall never has its table rows squeezed.
 *
 * Every `default` is the value the card used before the fit engine existed, so
 * a card with room to spare renders byte-for-byte as it always did - the engine
 * only ever moves a lever when the measured content is over the budget, and puts
 * it back as soon as it is not.
 *
 * `uses` is how many times the value is spent per card, which is what turns a
 * per-value minimum into a real pool of recoverable px.
 */
export interface FitLever {
  /** CSS custom property written on the card root. */
  readonly name: string;
  /** Value the card has always used. */
  readonly defaultValue: string;
  /** Smallest value the lever may take, and the reason for that floor. */
  readonly minValue: string;
  /** Times the value is spent on a card (per section, per row, ...). */
  readonly uses: number;
}

export const FIT_LEVERS: readonly FitLever[] = [
  {
    // The pure breathing room between the content box and the first/last
    // element. Floor is the hairline inset: any less and the content would sit
    // on top of the inner frame.
    name: "--card-content-pad",
    defaultValue: `${CONTENT_PY_MM}mm`,
    minValue: `${FRAME_STEP_MM}mm`,
    uses: 1,
  },
  {
    // Breathing room around the rule under the school name. Whitespace first.
    name: "--card-title-gap",
    defaultValue: "8px",
    minValue: "2px",
    uses: 2,
  },
  {
    // Space above the signature block. A signature wants air, so this goes
    // before the section gaps are touched.
    name: "--card-sig-gap",
    defaultValue: "32px",
    minValue: "8px",
    uses: 1,
  },
  {
    name: "--card-sig-pad",
    defaultValue: "24px",
    minValue: "6px",
    uses: 1,
  },
  {
    // The margin above each of the four boxed sections. Visible as separation
    // between blocks, so it is spent late.
    name: "--card-section-gap",
    defaultValue: "16px",
    minValue: "4px",
    uses: 4,
  },
  {
    // Row padding in the marks table. Last resort: it is the one lever that
    // changes the density of the information itself rather than the whitespace
    // around it.
    name: "--card-row-pad",
    defaultValue: "6px",
    minValue: "2px",
    // Per row, both edges.
    uses: 2,
  },
] as const;

/** Rows the row-padding lever is spent on, per extra body row. */
export const FIT_ROW_PADDING_USES = 2;
