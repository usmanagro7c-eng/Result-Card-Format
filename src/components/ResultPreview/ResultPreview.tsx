import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Maximize2, RotateCcw, X, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEFAULT_PRINTER_MARGIN_MM, normalizePrinterMarginMm } from "@/lib/cardGeometry";
import { registerBackHandler } from "@/utils/backButton";

const A4_WIDTH_PX = 794; // 210mm at 96dpi
const A4_HEIGHT_PX = 1123; // 297mm at 96dpi
const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;

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
 */
function MarginGuides({ marginMm }: { marginMm: number }) {
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
 * Helper to compute full-page fit scale (both width and height fit inside viewport).
 */
function computeFitPageScale(): number {
  if (typeof window === "undefined") return 0.5;
  const padX = window.innerWidth < 640 ? 16 : 32;
  const padY = window.innerWidth < 640 ? 76 : 96; // 56px header + 20px padding
  const scaleX = (window.innerWidth - padX) / A4_WIDTH_PX;
  const scaleY = (window.innerHeight - padY) / A4_HEIGHT_PX;
  return Math.max(MIN_SCALE, Math.min(1.0, Math.min(scaleX, scaleY)));
}

/**
 * Helper to compute fit-width scale.
 */
function computeFitWidthScale(): number {
  if (typeof window === "undefined") return 0.5;
  const padX = window.innerWidth < 640 ? 16 : 32;
  return Math.max(MIN_SCALE, Math.min(1.2, (window.innerWidth - padX) / A4_WIDTH_PX));
}

/**
 * Live A4 preview container with Pinch-to-Zoom, Double-Tap to Zoom, and Pan support.
 * Full view is rendered via a clean React Portal to avoid being trapped by parent overflow/transforms.
 */
export function ResultPreview({
  children,
  showControls = true,
  className,
  printerMarginMm,
}: ResultPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
  const [fullscreenScale, setFullscreenScale] = useState<number>(0.5);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showHint, setShowHint] = useState(true);

  // Keep refs up to date for touch event handlers
  const autoScaleRef = useRef(autoScale);
  autoScaleRef.current = autoScale;
  const manualZoomRef = useRef(manualZoom);
  manualZoomRef.current = manualZoom;
  const fullscreenScaleRef = useRef(fullscreenScale);
  fullscreenScaleRef.current = fullscreenScale;
  const isFullscreenRef = useRef(isFullscreen);
  isFullscreenRef.current = isFullscreen;

  // Touch gesture state refs
  const startDistRef = useRef(0);
  const startScaleRef = useRef(1);
  const isPinchingRef = useRef(false);
  const lastTapTimeRef = useRef(0);
  const lastTapPosRef = useRef({ x: 0, y: 0 });

  // Update inline autoScale on resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el || isFullscreen) return;
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

  // When opening fullscreen, initialize scale to fit whole page
  const openFullscreen = useCallback(() => {
    const fitPage = computeFitPageScale();
    setFullscreenScale(fitPage);
    setIsFullscreen(true);
  }, []);

  const closeFullscreen = useCallback(() => {
    setIsFullscreen(false);
  }, []);

  // Hardware Android back button support when fullscreen is active
  useEffect(() => {
    if (!isFullscreen) return;
    const unregister = registerBackHandler(() => {
      closeFullscreen();
      return true; // handled
    });
    return unregister;
  }, [isFullscreen, closeFullscreen]);

  // Keyboard Escape support
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFullscreen();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen, closeFullscreen]);

  // Lock body scroll when fullscreen is active
  useEffect(() => {
    if (!isFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen]);

  // Exiting fullscreen on print guarantees the card is never hidden
  useEffect(() => {
    const mql = window.matchMedia("print");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setIsFullscreen(false);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Auto-dismiss the mobile hint after 4 seconds
  useEffect(() => {
    const hintTimer = setTimeout(() => setShowHint(false), 4000);
    return () => clearTimeout(hintTimer);
  }, []);

  const activeScale = isFullscreen
    ? fullscreenScale
    : manualZoom !== null
      ? manualZoom
      : autoScale;

  const isAuto = !isFullscreen && manualZoom === null;

  const marginMm = normalizePrinterMarginMm(printerMarginMm);
  const showGuides = marginMm > DEFAULT_PRINTER_MARGIN_MM;

  const triggerAnimation = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 260);
  }, []);

  const setZoom = useCallback(
    (value: number, animate = true) => {
      if (animate) triggerAnimation();
      const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
      if (isFullscreenRef.current) {
        setFullscreenScale(clamped);
      } else {
        setManualZoom(clamped);
      }
    },
    [triggerAnimation],
  );

  const resetToFit = useCallback(() => {
    triggerAnimation();
    if (isFullscreenRef.current) {
      setFullscreenScale(computeFitPageScale());
      if (fullscreenContainerRef.current) {
        fullscreenContainerRef.current.scrollTo({ left: 0, top: 0, behavior: "smooth" });
      }
    } else {
      setManualZoom(null);
      if (containerRef.current) {
        containerRef.current.scrollTo({ left: 0, top: 0, behavior: "smooth" });
      }
    }
  }, [triggerAnimation]);

  const stepZoom = (delta: number) => {
    triggerAnimation();
    setZoom(activeScale + delta);
  };

  // Double-tap and Pinch-to-Zoom touch engine (attaches to whichever viewport container is active)
  useEffect(() => {
    const container = isFullscreen ? fullscreenContainerRef.current : containerRef.current;
    if (!container) return;

    const onTouchStart = (e: TouchEvent) => {
      setShowHint(false);

      if (e.touches.length === 2) {
        // Pinch gesture initiation
        isPinchingRef.current = true;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        startDistRef.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        startScaleRef.current = isFullscreenRef.current
          ? fullscreenScaleRef.current
          : (manualZoomRef.current ?? autoScaleRef.current);
        setIsAnimating(false);
      } else if (e.touches.length === 1) {
        isPinchingRef.current = false;
        const t = e.touches[0];
        const now = Date.now();
        const timeDiff = now - lastTapTimeRef.current;
        const distDiff = Math.hypot(
          t.clientX - lastTapPosRef.current.x,
          t.clientY - lastTapPosRef.current.y,
        );

        // Check for double-tap within 320ms and 35px radius
        if (timeDiff < 320 && distDiff < 35) {
          if (e.cancelable) e.preventDefault();
          triggerAnimation();

          const currentScale = isFullscreenRef.current
            ? fullscreenScaleRef.current
            : (manualZoomRef.current ?? autoScaleRef.current);

          const baseFit = isFullscreenRef.current
            ? computeFitPageScale()
            : autoScaleRef.current;

          const isZoomed = currentScale > baseFit + 0.15;

          if (isZoomed) {
            // Zoom out back to Fit
            if (isFullscreenRef.current) {
              setFullscreenScale(baseFit);
            } else {
              setManualZoom(null);
            }
            container.scrollTo({ left: 0, top: 0, behavior: "smooth" });
          } else {
            // Zoom in to 1.45x centered on the tapped point
            const target = 1.45;
            if (isFullscreenRef.current) {
              setFullscreenScale(target);
            } else {
              setManualZoom(target);
            }

            const rect = wrapperRef.current?.getBoundingClientRect();
            if (rect) {
              const relX = (t.clientX - rect.left) / currentScale;
              const relY = (t.clientY - rect.top) / currentScale;

              requestAnimationFrame(() => {
                const scrollX = relX * target - container.clientWidth / 2;
                const scrollY = relY * target - container.clientHeight / 2;
                container.scrollTo({
                  left: Math.max(0, scrollX),
                  top: Math.max(0, scrollY),
                  behavior: "smooth",
                });
              });
            }
          }

          lastTapTimeRef.current = 0;
          return;
        }

        lastTapTimeRef.current = now;
        lastTapPosRef.current = { x: t.clientX, y: t.clientY };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPinchingRef.current && startDistRef.current > 0) {
        // Prevent default native page zoom while pinching the document preview
        if (e.cancelable) e.preventDefault();

        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const factor = dist / startDistRef.current;

        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, startScaleRef.current * factor));
        if (isFullscreenRef.current) {
          setFullscreenScale(newScale);
        } else {
          setManualZoom(newScale);
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        isPinchingRef.current = false;
        startDistRef.current = 0;
      }
    };

    // Use non-passive listeners so preventDefault() stops browser outer-page zoom
    container.addEventListener("touchstart", onTouchStart, { passive: false });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd);
    container.addEventListener("touchcancel", onTouchEnd);

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [isFullscreen, triggerAnimation]);

  const fitPageScale = computeFitPageScale();
  const fitWidthScale = computeFitWidthScale();
  const isFitPage = Math.abs(activeScale - fitPageScale) < 0.04;
  const isFitWidth = Math.abs(activeScale - fitWidthScale) < 0.04;

  // The Card document itself (rendered at unscaled A4 dimensions with scaled wrapper)
  const renderCardDocument = () => (
    <div
      ref={wrapperRef}
      className="a4-scale-wrapper relative mx-auto"
      style={{
        width: `${Math.round(A4_WIDTH_PX * activeScale)}px`,
        height: `${Math.round(A4_HEIGHT_PX * activeScale)}px`,
        flexShrink: 0,
        transition: isAnimating
          ? "width 0.25s cubic-bezier(0.2, 0, 0, 1), height 0.25s cubic-bezier(0.2, 0, 0, 1)"
          : "none",
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
          transition: isAnimating ? "transform 0.25s cubic-bezier(0.2, 0, 0, 1)" : "none",
        }}
      >
        <div
          style={{
            width: A4_WIDTH_PX,
            minHeight: A4_HEIGHT_PX,
          }}
          className="a4-frame relative bg-white shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200/90"
        >
          {showGuides && <MarginGuides marginMm={marginMm} />}
          {children}
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn("relative w-full flex flex-col items-center select-none", className)}>
      {showControls ? (
        <div className="no-print mb-2 flex w-full flex-wrap items-center justify-between gap-1.5 px-0.5 sm:px-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="hidden sm:inline">A4 Document Preview</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums font-semibold text-slate-700">
              {Math.round(activeScale * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Desktop Preset buttons */}
            <div className="hidden items-center gap-1 sm:flex">
              {ZOOM_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={Math.abs(activeScale - preset) < 0.05 ? "secondary" : "ghost"}
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
              onClick={() => {
                if (Math.abs(activeScale - 1) < 0.05) {
                  resetToFit();
                } else {
                  setZoom(1);
                }
              }}
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
                onClick={resetToFit}
                className="h-8 gap-1 px-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50"
              >
                <RotateCcw className="size-3" /> Fit
              </Button>
            )}

            {/* Prominent Full View Button */}
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={openFullscreen}
              aria-label="Full view preview"
              title="Full view preview"
              className="h-8 gap-1.5 px-2.5 text-xs font-bold bg-blue-900 text-white hover:bg-blue-800 shadow-xs active:scale-95 transition-all"
            >
              <Maximize2 className="size-3.5" />
              <span>Full View</span>
            </Button>
          </div>
        </div>
      ) : null}

      {/* ── Inline Preview Container ── */}
      <div
        ref={containerRef}
        style={{ touchAction: "pan-x pan-y" }}
        className="a4-viewport relative w-full overflow-x-auto overscroll-contain pb-16 sm:pb-8"
      >
        {/* Floating Zoom Percentage & Reset Badge when zoomed in inline */}
        {!isAuto && Math.abs(activeScale - autoScale) > 0.05 && !isFullscreen ? (
          <div className="no-print pointer-events-auto fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full bg-slate-900/90 px-3.5 py-1.5 text-xs font-bold text-white shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
            <ZoomIn className="size-3.5 text-blue-400 shrink-0" />
            <span className="tabular-nums">{Math.round(activeScale * 100)}%</span>
            <div className="h-3 w-px bg-white/20" />
            <button
              type="button"
              onClick={resetToFit}
              className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-extrabold text-white hover:bg-white/30 active:scale-95 transition-all"
            >
              Reset to Fit
            </button>
          </div>
        ) : null}

        {/* Subtle first-time mobile hint */}
        {showHint && isAuto && !isFullscreen ? (
          <div className="no-print pointer-events-none fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 rounded-full bg-blue-950/85 px-3 py-1 text-[11px] font-semibold text-white shadow-md backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 sm:hidden">
            <span>👆 Double-tap or pinch to zoom</span>
          </div>
        ) : null}

        {/* If not in fullscreen, render the document inline */}
        {!isFullscreen && renderCardDocument()}

        {/* Inline placeholder while in Fullscreen mode */}
        {isFullscreen && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
            <Maximize2 className="size-8 text-blue-500 mb-2 animate-pulse" />
            <p className="text-sm font-bold text-slate-700">Currently viewing in Full View mode</p>
            <Button
              variant="outline"
              size="sm"
              onClick={closeFullscreen}
              className="mt-3 text-xs"
            >
              Return to editor
            </Button>
          </div>
        )}
      </div>

      {/* ── True Fullscreen Portal (Mounted directly to document.body) ── */}
      {isFullscreen && typeof document !== "undefined"
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Full view preview"
              className="no-print fixed inset-0 z-[100] flex flex-col bg-slate-950/95 text-white select-none backdrop-blur-md animate-in fade-in duration-200"
            >
              {/* Full View Sleek Header */}
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-slate-900/95 px-2.5 sm:px-4 shadow-lg">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeFullscreen}
                  className="h-9 gap-1.5 px-2 text-xs font-bold text-white hover:bg-white/10 active:scale-95 transition-all"
                >
                  <ArrowLeft className="size-4 text-slate-300" />
                  <span>Exit Full View</span>
                </Button>

                {/* Central Zoom Pills */}
                <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      triggerAnimation();
                      setFullscreenScale(fitPageScale);
                      fullscreenContainerRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" });
                    }}
                    className={cn(
                      "px-2 py-1 text-xs font-bold rounded-lg transition-all",
                      isFitPage ? "bg-blue-600 text-white shadow-xs" : "text-slate-300 hover:text-white hover:bg-white/5",
                    )}
                  >
                    Fit Page
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerAnimation();
                      setFullscreenScale(fitWidthScale);
                      fullscreenContainerRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" });
                    }}
                    className={cn(
                      "px-2 py-1 text-xs font-bold rounded-lg transition-all",
                      isFitWidth ? "bg-blue-600 text-white shadow-xs" : "text-slate-300 hover:text-white hover:bg-white/5",
                    )}
                  >
                    Fit Width
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerAnimation();
                      setFullscreenScale(1);
                    }}
                    className={cn(
                      "px-2 py-1 text-xs font-bold rounded-lg transition-all",
                      Math.abs(activeScale - 1) < 0.05 ? "bg-blue-600 text-white shadow-xs" : "text-slate-300 hover:text-white hover:bg-white/5",
                    )}
                  >
                    100%
                  </button>

                  <div className="h-3.5 w-px bg-white/20 mx-0.5" />

                  <button
                    type="button"
                    onClick={() => stepZoom(-0.15)}
                    disabled={activeScale <= MIN_SCALE + 0.01}
                    aria-label="Zoom out"
                    className="size-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 text-base font-bold"
                  >
                    −
                  </button>

                  <span className="min-w-9 text-center text-[11px] font-mono font-bold text-white tabular-nums">
                    {Math.round(activeScale * 100)}%
                  </span>

                  <button
                    type="button"
                    onClick={() => stepZoom(0.15)}
                    disabled={activeScale >= MAX_SCALE - 0.01}
                    aria-label="Zoom in"
                    className="size-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 text-base font-bold"
                  >
                    +
                  </button>
                </div>

                {/* Close X */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeFullscreen}
                  aria-label="Close full view"
                  className="size-9 p-0 text-slate-300 hover:text-white hover:bg-white/10 rounded-full"
                >
                  <X className="size-5" />
                </Button>
              </div>

              {/* Fullscreen Pan & Zoom Viewport */}
              <div
                ref={fullscreenContainerRef}
                style={{ touchAction: "pan-x pan-y" }}
                className="relative flex-1 w-full overflow-auto overscroll-contain p-2 sm:p-6 flex items-start justify-center bg-slate-950"
              >
                {/* Floating Reset pill in Fullscreen */}
                {Math.abs(activeScale - fitPageScale) > 0.05 && (
                  <div className="no-print pointer-events-auto fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-slate-900/95 border border-white/20 px-4 py-2 text-xs font-bold text-white shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95">
                    <ZoomIn className="size-3.5 text-blue-400 shrink-0" />
                    <span className="tabular-nums font-mono">{Math.round(activeScale * 100)}%</span>
                    <div className="h-3 w-px bg-white/20" />
                    <button
                      type="button"
                      onClick={() => {
                        triggerAnimation();
                        setFullscreenScale(fitPageScale);
                        fullscreenContainerRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" });
                      }}
                      className="rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-extrabold text-white hover:bg-blue-500 active:scale-95 transition-all"
                    >
                      Reset to Fit
                    </button>
                  </div>
                )}

                {/* Scaled A4 card rendered inside Full View */}
                {renderCardDocument()}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
