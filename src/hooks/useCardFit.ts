import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { FIT_LEVERS, PAGE_HEIGHT_PX, PX_PER_MM, type FitLever } from "@/lib/cardGeometry";

/**
 * `useLayoutEffect` warns when a component is server-rendered, and this card is
 * rendered during SSR as well as in the browser. The work below is DOM-only and
 * guarded by a null ref, so `useEffect` is the correct fallback there.
 */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Attribute marking the element whose height drives the fit. */
export const CARD_CONTENT_ATTR = "data-card-content";

/** Treat sub-pixel differences as noise. `scrollHeight` is integer-rounded, so
 *  a card that fits can still read a fraction over the sheet. */
const TOLERANCE_PX = 0.5;

/**
 * Take back slightly more than the measured overflow.
 *
 * The layout is linear in these levers - only vertical values move, so nothing
 * rewraps - so one proportional pass is enough. The margin absorbs the rounding
 * of `scrollHeight` and of the per-lever rounding on the way out.
 */
const SAFETY = 1.12;

/** Correction passes allowed. The first is exact in theory; the rest are for the
 *  case where a value lands on a rounding boundary. */
const MAX_PASSES = 3;

export interface CardFitState {
  /** Height the card wanted before the engine touched it, in CSS px. */
  naturalPx: number;
  /** Height the engine actually got it to, in CSS px. */
  finalPx: number;
  /** How much the engine had to take back, in CSS px. 0 for a card that fits. */
  compactedPx: number;
  /** Still over the sheet with every lever at its floor. */
  cannotFit: boolean;
  /** True when a lever moved at all, i.e. this card is not untouched. */
  compacted: boolean;
  /**
   * How far past the bottom of the sheet the card still reaches, in mm, for the
   * warning message. 0 for any card that fits. In mm rather than px because the
   * teacher needs a number they can act on, and no more precision than that.
   */
  overMm: number;
}

/** Shared initial value, so a consumer can hold state before the card mounts. */
export const DEFAULT_FIT_STATE: CardFitState = {
  naturalPx: 0,
  finalPx: 0,
  compactedPx: 0,
  cannotFit: false,
  compacted: false,
  overMm: 0,
};

const NO_CHANGE = DEFAULT_FIT_STATE;

type Values = ReadonlyMap<string, number>;

/** Every key comes from FIT_LEVERS, so a miss is a programming error, not state. */
function at(values: Values, name: string): number {
  const n = values.get(name);
  if (n === undefined) throw new Error(`unknown fit lever: ${name}`);
  return n;
}

const toPx = (value: string): number => {
  const n = parseFloat(value);
  return value.trim().endsWith("mm") ? n * (96 / 25.4) : n;
};

/**
 * How many times a lever is spent on this card. Only the table rows vary, with
 * the number of subjects.
 */
function usesFor(lever: FitLever, rowCount: number): number {
  return lever.name === "--card-row-pad" ? 2 * Math.max(1, rowCount) : lever.uses;
}

function defaultsOf(): Values {
  const v = new Map<string, number>();
  for (const lever of FIT_LEVERS) v.set(lever.name, toPx(lever.defaultValue));
  return v;
}

/**
 * Removes `want` px of height, cheapest lever first.
 *
 * Walks the levers in the order FIT_LEVERS declares, which is cheapest and least
 * visible first, so a card that is only slightly too tall never has the density
 * of its marks table touched.
 */
function drain(values: Values, want: number, rowCount: number): Values {
  const next = new Map(values);
  let remaining = want;
  for (const lever of FIT_LEVERS) {
    if (remaining <= 0) break;
    const uses = usesFor(lever, rowCount);
    const available = (at(next, lever.name) - toPx(lever.minValue)) * uses;
    if (available <= 0) continue;
    const take = Math.min(available, remaining);
    next.set(lever.name, at(next, lever.name) - take / uses);
    remaining -= take;
  }
  return next;
}

/**
 * Writes the levers to the card.
 *
 * A lever that is back at its default is written as the *original string*, not
 * as a computed pixel value, so a card with room to spare keeps byte-identical
 * computed styles rather than an equivalent-but-different re-expression of the
 * same length in px.
 */
function apply(root: HTMLElement, values: Values): void {
  for (const lever of FIT_LEVERS) {
    const v = at(values, lever.name);
    const atDefault = Math.abs(v - toPx(lever.defaultValue)) < 0.005;
    root.style.setProperty(
      lever.name,
      atDefault ? lever.defaultValue : `${Math.round(v * 100) / 100}px`,
    );
  }
}

function sameValues(a: Values, b: Values): boolean {
  return FIT_LEVERS.every((l) => Math.abs(at(a, l.name) - at(b, l.name)) < 0.005);
}

export interface UseCardFitOptions {
  /**
   * Changes whenever the sheet layout changes (today: the printer margin), so
   * the fit is re-solved immediately rather than waiting for the observer to
   * notice the different padding.
   */
  layoutKey: string | number;
  /** Rows in the marks table, which sets how much the row lever can give. */
  rowCount: number;
  /** Fired whenever the fit state changes. Used to surface the warning banner. */
  onStateChange?: ((state: CardFitState) => void) | undefined;
}

/**
 * Fits a card to the A4 sheet by taking back whitespace, never information.
 *
 * The card is a fixed-size box with a fixed frame, and the content inside it is
 * the only thing that varies. When the content is taller than the sheet, the
 * printed result is a second, mostly blank page with a bottom border on it - the
 * exact defect this whole change exists to remove. So the card is measured, and
 * if it is over the sheet the engine tightens the gaps between its sections just
 * enough to bring it back.
 *
 * Properties of the design, in order of importance:
 *
 *   - A card that fits is never touched. The levers default to the values the
 *     card has always used and are written back as those exact strings, so the
 *     common case is not merely similar, it is unchanged.
 *   - It only ever removes whitespace: never text, rows, images or type size.
 *   - It is reversible. As soon as there is room again the levers return to
 *     their defaults, so deleting a subject restores the original layout.
 *   - It converges to the least compaction that fits rather than to some fixed
 *     compact size, so a marginally-too-tall card loses marginally less.
 *
 * Measured with a `ResizeObserver` on the content block, which is what makes it
 * correct in the awkward cases: images that decode late, a web font swapping in,
 * and the mobile editor, where the card sits inside a `display: none` tab until
 * the moment the student opens the preview.
 */
export function useCardFit(
  cardRef: RefObject<HTMLElement | null>,
  { layoutKey, rowCount, onStateChange }: UseCardFitOptions,
): void {
  const stateRef = useRef<CardFitState>(NO_CHANGE);
  const appliedRef = useRef<Values | null>(null);
  const rowCountRef = useRef(rowCount);
  const onStateRef = useRef(onStateChange);
  rowCountRef.current = rowCount;
  onStateRef.current = onStateChange;

  useIsoLayoutEffect(() => {
    const root = cardRef.current;
    if (!root) return;
    const content = root.querySelector<HTMLElement>(`[${CARD_CONTENT_ATTR}]`);
    if (!content) return;

    let frame = 0;

    const solve = () => {
      const rows = rowCountRef.current;

      // Measure the natural height from the untouched layout, so the reported
      // figure is the card's real appetite rather than a leftover from the
      // previous solve.
      const untouched = defaultsOf();
      apply(root, untouched);
      const naturalPx = root.scrollHeight;

      let values = untouched;
      let remaining = Math.max(0, naturalPx - PAGE_HEIGHT_PX - TOLERANCE_PX);

      for (let pass = 0; pass <= MAX_PASSES && remaining > 0; pass++) {
        const before = values;
        values = drain(values, remaining * SAFETY, rows);
        if (sameValues(values, before)) break; // every lever is already at its floor
        apply(root, values);
        remaining = root.scrollHeight - PAGE_HEIGHT_PX - TOLERANCE_PX;
      }

      const finalPx = root.scrollHeight;
      const compactedPx = Math.max(0, naturalPx - finalPx);
      const cannotFit = finalPx - PAGE_HEIGHT_PX > TOLERANCE_PX;

      // A no-op solve would otherwise re-write all six properties and wake the
      // very observer that called it.
      if (appliedRef.current && sameValues(appliedRef.current, values)) return;
      appliedRef.current = values;

      const next: CardFitState = {
        naturalPx,
        finalPx,
        compactedPx,
        cannotFit,
        compacted: compactedPx > 0.5,
        overMm: cannotFit ? Math.max(0, (finalPx - PAGE_HEIGHT_PX) / PX_PER_MM) : 0,
      };
      const prev = stateRef.current;
      if (
        prev.naturalPx === next.naturalPx &&
        prev.finalPx === next.finalPx &&
        prev.cannotFit === next.cannotFit
      ) {
        return;
      }
      stateRef.current = next;
      onStateRef.current?.(next);
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(solve);
    };

    solve();

    // The content block, not the card: the card is pinned to the sheet by
    // `min-height`, so it does not change size when the content inside it grows
    // and would never fire for a card that is still under the sheet.
    const observer = new ResizeObserver(schedule);
    observer.observe(content);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [cardRef, layoutKey]);
}
