import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const A4_WIDTH_PX = 794; // 210mm at 96dpi
const A4_HEIGHT_PX = 1123; // 297mm at 96dpi
const MIN_SCALE = 0.3;
const MAX_SCALE = 2;

const ZOOM_PRESETS = [0.5, 0.75, 1] as const;

interface ResultPreviewProps {
  children: ReactNode;
  showControls?: boolean;
  className?: string;
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
export function ResultPreview({ children, showControls = true, className }: ResultPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScale, setAutoScale] = useState(0.85);
  const [manualZoom, setManualZoom] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const calculateScale = () => {
      const containerWidth = el.clientWidth;
      if (containerWidth > 0) {
        const computed = Math.min(1.0, (containerWidth - 16) / A4_WIDTH_PX);
        setAutoScale(Math.max(MIN_SCALE, computed));
      }
    };
    calculateScale();
    const observer = new ResizeObserver(calculateScale);
    observer.observe(el);
    return () => observer.disconnect();
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

  const setZoom = useCallback(
    (value: number) => setManualZoom(Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))),
    [],
  );

  const stepZoom = (delta: number) => setZoom((manualZoom ?? autoScale) + delta);

  return (
    <div className={cn("w-full flex flex-col items-center", className)}>
      {showControls ? (
        <div className="no-print mb-2 flex w-full flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="hidden sm:inline">A4 Document Preview</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums">
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
                  className="h-9 px-2.5 text-xs tabular-nums"
                >
                  {preset * 100}%
                </Button>
              ))}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => stepZoom(-0.1)}
              disabled={activeScale <= MIN_SCALE + 0.01}
              aria-label="Zoom out"
              className="size-11 p-0 sm:size-9"
            >
              <span className="text-lg leading-none">−</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => stepZoom(0.1)}
              disabled={activeScale >= MAX_SCALE - 0.01}
              aria-label="Zoom in"
              className="size-11 p-0 sm:size-9"
            >
              <span className="text-lg leading-none">+</span>
            </Button>

            {!isAuto && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setManualZoom(null)}
                className="h-11 gap-1 px-2 text-[11px] sm:h-9"
              >
                <RotateCcw className="size-3.5" /> Fit
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen((v) => !v)}
              aria-label={isFullscreen ? "Exit fullscreen preview" : "Fullscreen preview"}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              className="size-11 p-0 sm:size-9"
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
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
            : "pb-6",
        )}
      >
        {isFullscreen ? (
          <button
            type="button"
            aria-label="Close fullscreen preview"
            onClick={() => setIsFullscreen(false)}
            className="fixed right-3 top-3 z-50 flex size-11 items-center justify-center rounded-full bg-slate-900/85 text-white shadow-lg"
          >
            <Minimize2 className="size-5" />
          </button>
        ) : null}

        {/*
          `a4-scale` carries the transform so the print stylesheet can reset it
          with a single `transform: none !important`. The scale must never sit
          on a node that print CSS cannot reach, or the printed sheet renders
          shrunken and clipped.
        */}
        <div
          className="a4-scale"
          style={{
            transform: `scale(${activeScale})`,
            transformOrigin: "top left",
            width: "fit-content",
            marginInline: "auto",
          }}
        >
          <div
            style={{
              width: A4_WIDTH_PX,
              minHeight: A4_HEIGHT_PX,
            }}
            className="a4-frame bg-white shadow-[0_4px_25px_rgba(0,0,0,0.18)] ring-1 ring-neutral-300"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
