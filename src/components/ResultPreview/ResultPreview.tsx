import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEFAULT_PRINTER_MARGIN_MM, normalizePrinterMarginMm } from "@/lib/cardGeometry";

const A4_WIDTH_PX = 794; // 210mm at 96dpi
const A4_HEIGHT_PX = 1123; // 297mm at 96dpi
const MIN_SCALE = 0.2;
const MAX_SCALE = 2;

const ZOOM_PRESETS = [0.5, 0.75, 1] as const;

interface ResultPreviewProps {
  children: ReactNode;
  showControls?: boolean;
  className?: string;
  /**
   * The printer's unprintable margin, so the preview can show where the card's
   * frame will sit relative to the edge of the paper. See MarginGuides.
   */
  printerMarginMm?: number | undefined;
}

/**
 * Tints the strip of sheet the printer cannot reach.
 *
 * The card's frame is placed exactly on this boundary, so a bracket drawn there
 * would sit on top of the frame and say nothing. The dead band itself is the
 * part the teacher has never been able to see: on screen the frame always looks
 * comfortably inside the paper, and only a printout reveals that a 12.7mm
 * machine was eating the bottom border. Showing the band makes the cost of a
 * larger margin visible at the moment it is chosen - the printable area really
 * does shrink - and confirms that the frame still clears it.
 *
 * Only shown above the default margin. At 10mm the frame is where it has always
 * been, and permanent decoration on the common preview would cost more clarity
 * than the reassurance is worth.
 */
function MarginGuides({ marginMm }: { marginMm: number }) {
  // Unit is explicit because a bare number here would be read as px, which is
  // 3.8x too small to line up with the card's own margin.
  const size = `${marginMm}mm`;
  return (
    <div
      aria-hidden
      data-margin-guides
      className="no-print pointer-events-none absolute inset-0 overflow-hidden"
    >
      <span
        data-margin-edge="top"
        className="absolute inset-x-0 top-0 border-b border-dashed border-sky-500/60 bg-sky-500/10"
        style={{ height: size }}
      />
      <span
        data-margin-edge="bottom"
        className="absolute inset-x-0 bottom-0 border-t border-dashed border-sky-500/60 bg-sky-500/10"
        style={{ height: size }}
      />
      <span
        data-margin-edge="left"
        className="absolute inset-y-0 left-0 border-r border-dashed border-sky-500/60 bg-sky-500/10"
        style={{ width: size }}
      />
      <span
        data-margin-edge="right"
        className="absolute inset-y-0 right-0 border-l border-dashed border-sky-500/60 bg-sky-500/10"
        style={{ width: size }}
      />
    </div>
  );
}

/**
 * Live A4 preview container.
 *
 * Mobile notes:
 * - Scaling is derived from the *available* width, not the viewport, so the
 *   document is never clipped by surrounding card padding.
 * - Centering uses `width: fit-content; margin-inline: auto` instead of
 *   `justify-content: center`. `justify-center` on an overflow container clips
 *   the left edge of over-wide children with no way to scroll back to it.
 * - A4 is 794px wide, so "fit width" on a 375px phone lands near 0.4 scale,
 *   where 13.5px document text renders around 5px. Presets + fullscreen exist
 *   so the page can actually be read.
 */
export function ResultPreview({
  children,
  showControls = true,
  className,
  printerMarginMm,
}: ResultPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScale, setAutoScale] = useState(() => {
    if (typeof window !== "undefined") {
      const w = window.innerWidth;
      if (w < 768) {
        return Math.max(MIN_SCALE, Math.min(1.0, (w - 24) / A4_WIDTH_PX));
      }
    }
    return 0.85;
  });
  const [manualZoom, setManualZoom] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const calculateScale = () => {
      const containerWidth = el.clientWidth;
      if (containerWidth > 0) {
        const pad = containerWidth < 500 ? 8 : 16;
        const computed = Math.min(1.0, (containerWidth - pad) / A4_WIDTH_PX);
        setAutoScale(Math.max(MIN_SCALE, computed));
      }
    };
    calculateScale();
    const rafId = requestAnimationFrame(calculateScale);
    const timerId = setTimeout(calculateScale, 100);

    const observer = new ResizeObserver(calculateScale);
    observer.observe(el);
    window.addEventListener("resize", calculateScale);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
      observer.disconnect();
      window.removeEventListener("resize", calculateScale);
    };
  }, [isFullscreen]);

  // Exiting fullscreen on print guarantees the card is never hidden by the
  // overlay when the user hits Print/PDF while zoomed in.
  useEffect(() => {
    const mql = window.matchMedia("print");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setIsFullscreen(false);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const activeScale = manualZoom !== null ? manualZoom : autoScale;
  const isAuto = manualZoom === null;

  // The guides are screen-only, so the paper edge they mark is only ever a
  // preview concern; they are deliberately absent from print and from the
  // html2canvas clone, which render the frame itself as the outermost ink.
  const marginMm = normalizePrinterMarginMm(printerMarginMm);
  const showGuides = marginMm > DEFAULT_PRINTER_MARGIN_MM;

  const setZoom = useCallback(
    (value: number) => setManualZoom(Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))),
    [],
  );

  const stepZoom = (delta: number) => setZoom((manualZoom ?? autoScale) + delta);

  return (
    <div className={cn("w-full flex flex-col items-center", className)}>
      {showControls ? (
        <div className="no-print mb-2 flex w-full flex-wrap items-center justify-between gap-1.5 px-0.5 sm:px-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="hidden sm:inline">A4 Document Preview</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums font-semibold text-slate-700">
              {Math.round(activeScale * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-1">
            <div className="hidden items-center gap-1 sm:flex">
              {ZOOM_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={Math.abs(activeScale - preset) < 0.01 ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setZoom(preset)}
                  className="h-8 px-2 text-xs tabular-nums"
                >
                  {preset * 100}%
                </Button>
              ))}
            </div>

            {/* Quick 100% / Fit toggle on mobile */}
            <Button
              type="button"
              variant={Math.abs(activeScale - 1) < 0.05 ? "secondary" : "outline"}
              size="sm"
              onClick={() => setZoom(Math.abs(activeScale - 1) < 0.05 ? autoScale : 1)}
              className="h-8 px-2 text-xs font-bold sm:hidden"
            >
              {Math.abs(activeScale - 1) < 0.05 ? "Fit" : "100%"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => stepZoom(-0.15)}
              disabled={activeScale <= MIN_SCALE + 0.01}
              aria-label="Zoom out"
              className="size-8 p-0 text-slate-700 hover:bg-slate-100"
            >
              <span className="text-base font-bold leading-none">−</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => stepZoom(0.15)}
              disabled={activeScale >= MAX_SCALE - 0.01}
              aria-label="Zoom in"
              className="size-8 p-0 text-slate-700 hover:bg-slate-100"
            >
              <span className="text-base font-bold leading-none">+</span>
            </Button>

            {!isAuto && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setManualZoom(null)}
                className="h-8 gap-1 px-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50"
              >
                <RotateCcw className="size-3" /> Fit
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen((v) => !v)}
              aria-label={isFullscreen ? "Exit fullscreen preview" : "Fullscreen preview"}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              className="size-8 p-0 text-slate-700 hover:bg-slate-100"
            >
              {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </Button>
          </div>
        </div>
      ) : null}

      <div
        ref={containerRef}
        className={cn(
          "a4-viewport w-full overflow-x-auto",
          isFullscreen
            ? "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-slate-200/95 p-2 backdrop-blur-sm"
            : "pb-3 sm:pb-6",
        )}
      >
        {isFullscreen ? (
          <button
            type="button"
            aria-label="Close fullscreen preview"
            onClick={() => setIsFullscreen(false)}
            className="fixed right-3 top-3 z-50 flex size-10 items-center justify-center rounded-full bg-slate-900/85 text-white shadow-lg"
          >
            <Minimize2 className="size-4" />
          </button>
        ) : null}

        {/*
          `a4-scale-wrapper` has the EXACT scaled layout dimensions.
          Its margin: 0 auto centers it horizontally without creating overflow.
          Inside it, `a4-scale` is anchored to top-left of the wrapper (top: 0, left: 0),
          so scaling matches the wrapper dimensions exactly with 0px offset.
        */}
        <div
          className="a4-scale-wrapper relative mx-auto"
          style={{
            width: `${Math.round(A4_WIDTH_PX * activeScale)}px`,
            height: `${Math.round(A4_HEIGHT_PX * activeScale)}px`,
            flexShrink: 0,
          }}
        >
          <div
            className="a4-scale"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              transform: `scale(${activeScale})`,
              transformOrigin: "top left",
              width: `${A4_WIDTH_PX}px`,
              minHeight: `${A4_HEIGHT_PX}px`,
            }}
          >
            <div
              style={{
                width: A4_WIDTH_PX,
                minHeight: A4_HEIGHT_PX,
              }}
              className="a4-frame relative bg-white shadow-2xl shadow-slate-900/15 ring-1 ring-slate-200/90"
            >
              {children}
              {showGuides ? <MarginGuides marginMm={marginMm} /> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
