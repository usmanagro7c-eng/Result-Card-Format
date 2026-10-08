import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileCheck2,
  FileDown,
  Pencil,
  Printer,
  Share2,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResultCard } from "@/components/ResultCard/ResultCard";
import { ResultPreview } from "@/components/ResultPreview/ResultPreview";
import { SubjectTable } from "@/components/SubjectTable/SubjectTable";
import { PRESET_REMARKS, useResultStore } from "@/store/resultStore";
import { calculateTotals, subjectErrors } from "@/utils/calculations";
import { compressImage } from "@/utils/image";
import { generatePdf, sharePdf } from "@/utils/pdf";
import { printDocument } from "@/utils/print";
import { GradeText } from "@/utils/raisedText";
import { DEFAULT_FIT_STATE, type CardFitState } from "@/hooks/useCardFit";
import { useIsMobile } from "@/hooks/use-mobile";
import { triggerConfetti } from "@/utils/confetti";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { cn } from "@/lib/utils";

type EditorTab = "info" | "marks" | "remarks" | "preview";

export const Route = createFileRoute("/editor/$studentId")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { print?: true | undefined; tab?: EditorTab | undefined } => ({
    print: search["print"] === true || search["print"] === "true" ? true : undefined,
    tab:
      search["tab"] === "info" ||
      search["tab"] === "marks" ||
      search["tab"] === "remarks" ||
      search["tab"] === "preview"
        ? (search["tab"] as EditorTab)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Result Editor — School Result Card Generator" },
      {
        name: "description",
        content:
          "Enter subjects and marks with instant A4 progress report live preview before printing or exporting to PDF.",
      },
      { property: "og:title", content: "Result Editor — School Result Card Generator" },
      {
        property: "og:description",
        content: "Enter marks and preview the printable A4 class progress report live.",
      },
    ],
  }),
  component: ResultEditor,
});

const EDITOR_TABS = [
  { id: "info" as const, label: "Student Info", shortLabel: "Info", icon: Users },
  { id: "marks" as const, label: "Subject Marks", shortLabel: "Marks", icon: BookOpen },
  { id: "remarks" as const, label: "Remarks", shortLabel: "Remarks", icon: Sparkles },
  { id: "preview" as const, label: "Live Preview", shortLabel: "Preview", icon: Eye },
];

function ResultEditor() {
  const { studentId } = Route.useParams();
  const { print, tab } = Route.useSearch();
  const navigate = useNavigate();
  const { ready, students, getStudent, updateStudent, settings, storageFull } = useResultStore();

  const student = getStudent(studentId);
  const cardRef = useRef<HTMLDivElement>(null);
  const exportCardRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [fitState, setFitState] = useState<CardFitState>(DEFAULT_FIT_STATE);
  const printed = useRef(false);
  /**
   * Mounts the off-screen capture card for the duration of a PDF export only.
   * Keeping it mounted permanently meant a second full 794x1123 ResultCard with
   * its own fit observers lived on every editor screen for the whole session,
   * which is pure overhead on a low-memory device.
   */
  const [isPdfExporting, setIsPdfExporting] = useState(false);

  // Auto-trigger print if requested via query parameter
  useEffect(() => {
    if (print && ready && student && !printed.current) {
      printed.current = true;
      setTimeout(printDocument, 450);
    }
  }, [print, ready, student]);

  // Previous & Next Student for rapid workflow
  const { prevStudentId, nextStudentId, currentIndex, totalStudents } = useMemo(() => {
    if (!students || students.length === 0) {
      return { prevStudentId: null, nextStudentId: null, currentIndex: -1, totalStudents: 0 };
    }
    const idx = students.findIndex((s) => s.id === studentId);
    return {
      currentIndex: idx,
      totalStudents: students.length,
      prevStudentId: idx > 0 ? (students[idx - 1]?.id ?? null) : null,
      nextStudentId: idx >= 0 && idx < students.length - 1 ? (students[idx + 1]?.id ?? null) : null,
    };
  }, [students, studentId]);

  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<EditorTab>(tab ?? (print ? "preview" : "info"));
  const TAB_ORDER: EditorTab[] = useMemo(() => ["info", "marks", "remarks", "preview"], []);
  const [tabDirection, setTabDirection] = useState<"right" | "left">("right");

  const handleTabChange = (newTab: EditorTab) => {
    const currentIdx = TAB_ORDER.indexOf(activeTab);
    const newIdx = TAB_ORDER.indexOf(newTab);
    setTabDirection(newIdx >= currentIdx ? "right" : "left");
    setActiveTab(newTab);
  };

  // 1-finger horizontal swipe gesture on editor to switch between students
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleEditorTouchStart = (e: React.TouchEvent) => {
    if (activeTab === "preview") return; // avoid interfering with preview gestures
    const t = e.touches[0];
    if (t) touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleEditorTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || activeTab === "preview") return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(dx) > 75 && Math.abs(dy) < 55) {
      if (dx < 0 && nextStudentId) {
        toast.info("Swiped to Next Student →", { duration: 900 });
        navigate({ to: "/editor/$studentId", params: { studentId: nextStudentId } });
      } else if (dx > 0 && prevStudentId) {
        toast.info("← Swiped to Previous Student", { duration: 900 });
        navigate({ to: "/editor/$studentId", params: { studentId: prevStudentId } });
      }
    }
  };

  // If search param changes (e.g. navigation with tab: "preview")
  useEffect(() => {
    if (tab) setActiveTab(tab);
  }, [tab]);

  // The A4 card lives in the preview panel, which is display:none while the
  // Form tab is active on mobile. Force the preview visible for any print path, whether
  // it comes from the ?print= param or the browser's own Ctrl/Cmd+P.
  useEffect(() => {
    const revealPreview = () => setActiveTab("preview");
    window.addEventListener("beforeprint", revealPreview);
    return () => window.removeEventListener("beforeprint", revealPreview);
  }, []);

  useEffect(() => {
    if (print) setActiveTab("preview");
  }, [print]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-5xl px-3 pt-4 sm:px-6 space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl border border-slate-200/90 bg-slate-100/90">
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <Skeleton className="h-5 w-40 rounded-md" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center space-y-4">
        <h2 className="text-xl font-bold">Student Record Not Found</h2>
        <p className="text-sm text-muted-foreground">
          The requested student does not exist or has been deleted.
        </p>
        <Button asChild className="mt-4">
          <Link to="/">Back to Student List</Link>
        </Button>
      </div>
    );
  }

  const errors = subjectErrors(student.subjects);
  const hasErrors = Object.keys(errors).length > 0;
  const includeSummerWork = student.includeSummerWork ?? false;
  const totals = calculateTotals(student.subjects, settings.grades, includeSummerWork);

  // Celebration Confetti when A+ grade student preview is viewed
  useEffect(() => {
    if (activeTab === "preview" && (totals.grade === "A+" || totals.percentage >= 90)) {
      const timer = setTimeout(() => {
        triggerConfetti();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [activeTab, totals.grade, totals.percentage]);

  const handlePdf = async () => {
    setBusy(true);
    setIsPdfExporting(true);
    try {
      await new Promise((r) => setTimeout(r, 100));
      const target =
        (exportCardRef.current?.firstElementChild as HTMLElement | null) || cardRef.current;
      if (!target) throw new Error("Render target not found");
      const fileName = `${(student.name || "Student").replace(/\s+/g, "-")}-Result-Card.pdf`;
      const saved = await generatePdf([target], fileName);
      toast.success(
        saved?.inDownloads
          ? `Saved to Downloads/${fileName}`
          : saved?.native
            ? `Saved to ${saved.location}`
            : "PDF downloaded successfully",
      );
    } catch (err) {
      console.error(err);
      toast.error("Could not generate the PDF. Please try again.");
    } finally {
      setBusy(false);
      setIsPdfExporting(false);
    }
  };

  const handleSharePdf = async () => {
    setIsSharing(true);
    setBusy(true);
    setIsPdfExporting(true);
    try {
      await new Promise((r) => setTimeout(r, 100));
      const target =
        (exportCardRef.current?.firstElementChild as HTMLElement | null) || cardRef.current;
      if (!target) throw new Error("Render target not found");
      const fileName = `${(student.name || "Student").replace(/\s+/g, "-")}-Result-Card.pdf`;
      const result = await sharePdf([target], fileName, {
        title: `${student.name || "Student"} - Result Card`,
        text: `Official Progress Report & Result Card for ${student.name || "Student"} (${student.className || ""}) - The Country School`,
        dialogTitle: "Send Result Card to Parent via WhatsApp",
      });
      if (result.shared) {
        toast.success(`Share sheet opened for ${student.name || "Student"}`);
      } else if (result.error) {
        toast.info(result.error);
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not prepare PDF for sharing");
    } finally {
      setIsSharing(false);
      setBusy(false);
      setIsPdfExporting(false);
    }
  };

  const set = (patch: Parameters<typeof updateStudent>[1]) => {
    updateStudent(student.id, patch);
  };

  const handlePhotoUpload = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await compressImage(file);
      set({ photoDataUrl: dataUrl });
      toast.success(`Photo added (~${Math.round((dataUrl.length * 0.75) / 1024)} KB)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that image file.");
    } finally {
      setPhotoBusy(false);
      // Allow re-selecting the same file after a failed attempt.
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  return (
    <>
      <div
        className="print-shell mx-auto w-full max-w-5xl px-3 pt-3 bottom-bar-clearance sm:px-6 sm:pt-4 touch-pan-y"
        onTouchStart={handleEditorTouchStart}
        onTouchEnd={handleEditorTouchEnd}
      >
        {/* Top Action Bar */}
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2.5 sm:mb-5 sm:gap-3">
          <div className="flex items-center gap-1">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="min-h-11 gap-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:min-h-9 font-semibold"
            >
              <Link to="/">
                <ArrowLeft className="size-4" /> Students
              </Link>
            </Button>

            {totalStudents > 1 && currentIndex >= 0 ? (
              <div className="flex items-center gap-0.5 border-l border-slate-200 pl-2">
                <span className="mr-1 hidden text-xs font-medium text-slate-400 min-[380px]:inline">
                  {currentIndex + 1} / {totalStudents}
                </span>
                <button
                  disabled={!prevStudentId}
                  title="Previous Student"
                  aria-label="Previous student"
                  onClick={() =>
                    prevStudentId &&
                    navigate({ to: "/editor/$studentId", params: { studentId: prevStudentId } })
                  }
                  className="flex size-11 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30 sm:size-8"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  disabled={!nextStudentId}
                  title="Next Student"
                  aria-label="Next student"
                  onClick={() =>
                    nextStudentId &&
                    navigate({ to: "/editor/$studentId", params: { studentId: nextStudentId } })
                  }
                  className="flex size-11 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30 sm:size-8"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-save badge — visible on all screen sizes */}
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">
              <FileCheck2 className="size-3.5" />
              <span className="hidden sm:inline">Auto-saved</span>
            </div>

            {!isMobile && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={printDocument}
                  className="min-h-9 gap-1.5 border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Printer className="size-4" />
                  Print
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSharePdf}
                  disabled={busy || hasErrors}
                  className="min-h-9 gap-1.5 border-emerald-300 bg-emerald-50/80 text-xs sm:text-sm font-bold text-emerald-800 shadow-2xs hover:bg-emerald-100 disabled:opacity-60"
                >
                  <Share2 className="size-3.5" />
                  {isSharing ? "Sharing..." : "Share Card"}
                </Button>

                <Button
                  size="sm"
                  onClick={handlePdf}
                  disabled={busy || hasErrors}
                  className="min-h-9 gap-1.5 bg-blue-900 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
                >
                  <FileDown className="size-4" />
                  {busy && !isSharing ? "Preparing..." : "Download PDF"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Storage Full Warning */}
        {storageFull ? (
          <div className="no-print mb-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-rose-500" />
            <p className="leading-snug">
              <span className="font-semibold">
                Browser storage is full — changes are not being saved.
              </span>{" "}
              Remove a few student photos or delete a student to free space, then reload this page.
            </p>
          </div>
        ) : null}

        {/* Cannot-fit Warning */}
        {fitState.cannotFit ? (
          <div className="no-print mb-4 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900">
            <TriangleAlert className="size-4 shrink-0 text-amber-500" />
            <p>
              Card is ~{Math.max(1, Math.round(fitState.overMm))}mm too tall for 1 page. Reduce
              subjects or remarks to fit.
            </p>
          </div>
        ) : null}

        {/* Mobile Live Grade & Marks Summary Bar (< sm) */}
        <div className="no-print mb-3 flex items-center justify-between rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-white p-3 shadow-xs sm:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-900 text-white font-black text-xs shadow-xs">
              {student.photoDataUrl ? (
                <img
                  src={student.photoDataUrl}
                  alt={student.name || "Student"}
                  className="size-full object-cover"
                />
              ) : (
                (student.name || "?")[0]?.toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-slate-900 text-sm truncate leading-tight">
                {student.name || "Untitled Student"}
              </h3>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5 truncate">
                {student.className ? `Class ${student.className}` : "No class"}
                {student.rollNumber && ` • Roll #${student.rollNumber}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <div className="text-xs font-black text-slate-900 tabular-nums">
                <AnimatedCounter value={totals.obtainedTotal} />{" "}
                <span className="text-[10px] font-normal text-slate-400">/ {totals.grandTotal}</span>
              </div>
              <div className="text-[11px] font-bold text-blue-900 tabular-nums">
                <AnimatedCounter value={totals.percentage} decimals={1} />%
              </div>
            </div>
            <span
              className={cn(
                "inline-flex items-center justify-center rounded-xl border px-2.5 py-1 text-xs font-black shadow-2xs tabular-nums",
                totals.grade === "A+" || totals.grade === "A"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 glow-grade-emerald"
                  : totals.grade === "B" || totals.grade === "C"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : totals.grade === "D"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-rose-50 text-rose-700 border-rose-200",
              )}
            >
              {totals.grade}
            </span>
          </div>
        </div>

        {/* Mobile Sleek Segmented Tab Control (< sm) */}
        <div className="no-print mb-3.5 sm:hidden">
          <div
            role="tablist"
            aria-label="Editor panels"
            className="grid grid-cols-4 gap-1 rounded-2xl border border-slate-200/90 bg-slate-100/90 p-1 shadow-inner"
          >
            {EDITOR_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "press-card flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-extrabold transition-all",
                    isActive
                      ? "bg-white text-blue-950 shadow-xs"
                      : "text-slate-500 hover:text-slate-900",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0 transition-colors",
                      isActive ? "text-blue-900" : "text-slate-400",
                    )}
                  />
                  <span className="leading-tight">{tab.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop / Tablet Segmented Tabs (>= sm) */}
        <div className="no-print mb-6 hidden sm:block">
          <div
            role="tablist"
            aria-label="Editor sections"
            className="grid grid-cols-4 gap-1.5 rounded-2xl border border-slate-200/90 bg-slate-100/90 p-1.5 shadow-inner"
          >
            {EDITOR_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "flex min-h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all sm:text-sm active:scale-95",
                    isActive
                      ? "bg-white text-blue-950 shadow-sm"
                      : "text-slate-600 hover:bg-white/60 hover:text-slate-900",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0 transition-colors",
                      isActive ? "text-blue-900" : "text-slate-400",
                    )}
                  />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Editor Tab Panels */}
        <div className="space-y-4">
          {/* ── Student Info Card ── */}
          {activeTab === "info" && (
            <div
              className={cn(
                "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
                tabDirection === "right" ? "animate-tab-slide-right" : "animate-tab-slide-left",
              )}
            >
              {/* Card header */}
              <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5 sm:py-3.5">
                <div className="flex size-7 items-center justify-center rounded-lg bg-blue-900 text-white">
                  <Users className="size-3.5" />
                </div>
                <h2 className="text-sm font-bold text-slate-800">Student Information</h2>
              </div>

              {/* Name + Class fields */}
              <div className="grid gap-3 p-3.5 sm:gap-4 sm:p-5 sm:grid-cols-2">
                <Field
                  label="Student Name"
                  required
                  error={!student.name.trim() ? "Name is required" : undefined}
                >
                  <Input
                    value={student.name}
                    onChange={(e) => set({ name: e.target.value })}
                    placeholder="e.g. Usman Amjad"
                    className={`border-slate-200 bg-slate-50/50 focus-visible:bg-white ${
                      !student.name.trim() ? "border-rose-400 focus-visible:ring-rose-300" : ""
                    }`}
                  />
                </Field>

                <Field label="Class">
                  <Input
                    value={student.className}
                    onChange={(e) => set({ className: e.target.value })}
                    placeholder="e.g. 10th"
                    className="border-slate-200 bg-slate-50/50 focus-visible:bg-white"
                  />
                </Field>
              </div>

              {/* Photo toggle */}
              <div className="border-t border-slate-100 px-3.5 py-3 sm:px-5 sm:py-4">
                <div className="flex items-center justify-between gap-3">
                  <Label
                    htmlFor="show-photo"
                    className="cursor-pointer text-sm font-semibold text-slate-800"
                  >
                    Show photo on result card
                  </Label>
                  <Switch
                    id="show-photo"
                    checked={student.showPhoto ?? false}
                    onCheckedChange={(checked) => set({ showPhoto: checked })}
                    aria-label="Show photo on result card"
                  />
                </div>

                {student.showPhoto ? (
                  <div className="mt-3 flex items-center gap-3.5 sm:mt-4 sm:gap-4">
                    <div className="flex h-[74px] w-[56px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
                      {student.photoDataUrl ? (
                        <img
                          src={student.photoDataUrl}
                          alt="Student photo preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] uppercase text-slate-400">No photo</span>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => void handlePhotoUpload(e.target.files?.[0])}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={photoBusy}
                        onClick={() => photoInputRef.current?.click()}
                        className="min-h-9 gap-1.5 border-slate-300 text-sm text-slate-700 hover:bg-slate-100"
                      >
                        <Upload className="size-4" />
                        {photoBusy
                          ? "Processing..."
                          : student.photoDataUrl
                            ? "Change Photo"
                            : "Upload Photo"}
                      </Button>
                      {student.photoDataUrl ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => set({ photoDataUrl: null })}
                          className="min-h-9 gap-1.5 text-sm text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-4" /> Remove
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* ── Subject Marks Card ── */}
          {activeTab === "marks" && (
            <div
              className={cn(
                "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
                tabDirection === "right" ? "animate-tab-slide-right" : "animate-tab-slide-left",
              )}
            >
              {/* Card header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5 sm:py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-violet-600 text-white">
                    <BookOpen className="size-3.5" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-800">Subject Marks</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                  {student.subjects.length} subject{student.subjects.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="p-3 sm:p-5">
                <SubjectTable
                  subjects={student.subjects}
                  onChange={(subjects) => set({ subjects })}
                  includeSummerWork={includeSummerWork}
                  onIncludeSummerWorkChange={(value) => set({ includeSummerWork: value })}
                />
              </div>

              {/* Results Summary Strip */}
              <div className="grid grid-cols-4 divide-x divide-slate-100 border-t border-slate-100 bg-gradient-to-b from-slate-50 to-white">
                {[
                  { label: "Total", value: totals.grandTotal, color: "text-slate-700" },
                  { label: "Obtained", value: totals.obtainedTotal, color: "text-slate-700" },
                  { label: "Percentage", value: `${totals.percentage}%`, color: "text-blue-700" },
                  {
                    label: "Grade",
                    value: totals.grade,
                    raiseSign: true,
                    color:
                      totals.grade === "A+" || totals.grade === "A"
                        ? "text-emerald-700"
                        : totals.grade === "F" || totals.grade === "E"
                          ? "text-rose-600"
                          : "text-amber-600",
                  },
                ].map((item) => (
                  <div key={item.label} className="px-1.5 py-2 text-center sm:px-3 sm:py-3">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5 sm:mb-1">
                      {item.label}
                    </span>
                    <span className={`text-lg sm:text-xl font-black tabular-nums ${item.color}`}>
                      {item.label === "Obtained" ? (
                        <AnimatedCounter value={totals.obtainedTotal} />
                      ) : item.label === "Percentage" ? (
                        <>
                          <AnimatedCounter value={totals.percentage} decimals={1} />%
                        </>
                      ) : item.raiseSign ? (
                        <GradeText text={String(item.value)} />
                      ) : (
                        item.value
                      )}
                    </span>
                  </div>
                ))}
              </div>

              {hasErrors && (
                <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 sm:px-5 sm:py-2.5">
                  <p className="text-xs font-semibold text-rose-600">
                    ⚠️ Fix mark errors above before printing or downloading PDF.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Remarks Card ── */}
          {activeTab === "remarks" && (
            <div
              className={cn(
                "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
                tabDirection === "right" ? "animate-tab-slide-right" : "animate-tab-slide-left",
              )}
            >
              <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5 sm:py-3.5">
                <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500 text-white">
                  <Sparkles className="size-3.5" />
                </div>
                <h2 className="text-sm font-bold text-slate-800">Remarks</h2>
              </div>
              <div className="space-y-2.5 p-3.5 sm:space-y-3 sm:p-5">
                <Select value="" onValueChange={(value) => set({ remarks: value })}>
                  <SelectTrigger className="w-full border-slate-200 bg-slate-50/50 text-sm">
                    <SelectValue placeholder="Choose a predefined remark..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESET_REMARKS.map((remark) => (
                      <SelectItem key={remark} value={remark}>
                        {remark}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Textarea
                  rows={3}
                  value={student.remarks}
                  onChange={(e) => set({ remarks: e.target.value })}
                  placeholder="Enter or customize remarks..."
                  className="resize-none border-slate-200 bg-slate-50/50 text-sm focus-visible:bg-white"
                />

                {/* Quick Preset Remark Chips */}
                <div className="pt-1">
                  <span className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Quick suggestions:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_REMARKS.map((r) => {
                      const isSelected = student.remarks === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => set({ remarks: r })}
                          className={cn(
                            "press-card rounded-xl px-2.5 py-1 text-xs font-semibold transition-all text-left",
                            isSelected
                              ? "bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs"
                              : "bg-slate-100/90 text-slate-700 hover:bg-slate-200/70 border border-slate-200/50",
                          )}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab 4: Live Preview ── */}
          <div
            className={cn(
              "print-root",
              activeTab === "preview"
                ? cn("block", tabDirection === "right" ? "animate-tab-slide-right" : "animate-tab-slide-left")
                : "hidden print:block",
            )}
          >
            <div className="a4-panel overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* Preview header */}
              <div className="no-print flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-3.5 py-2.5 sm:px-5 sm:py-3">
                <div className="flex items-center gap-2">
                  <Eye className="size-3.5 text-slate-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    Live Preview
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Realtime percentage mini-badge */}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
                      totals.grade === "A+" || totals.grade === "A"
                        ? "bg-emerald-100 text-emerald-700 glow-grade-emerald"
                        : totals.grade === "F" || totals.grade === "E"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-700",
                    )}
                  >
                    <AnimatedCounter value={totals.percentage} decimals={1} />% &middot; {totals.grade}
                  </span>
                </div>
              </div>
              <div className="a4-chrome p-1.5 sm:p-4">
                <ResultPreview key={activeTab} printerMarginMm={settings.printerMarginMm}>
                  <ResultCard
                    ref={cardRef}
                    student={student}
                    subjects={student.subjects}
                    settings={settings}
                    includeSummerWork={includeSummerWork}
                    onFitStateChange={setFitState}
                  />
                </ResultPreview>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/*
       * Mobile bottom action bar.
       *
       * Rendered as a sibling *outside* the `.animate-fade-in` container on
       * purpose. That container keeps `transform: translateY(0)` applied
       * permanently (the keyframe animation uses `forwards`), and a transformed
       * ancestor becomes the containing block for `position: fixed`
       * descendants — nesting this bar inside would pin it to the bottom of the
       * scrolling content instead of the viewport. Height and clearance are both
       * driven by `--bottom-bar-h`, matching the app's bottom navigation.
       */}
      {isMobile ? (
        <div className="no-print bottom-bar flex items-center gap-2 px-3 pt-2">
          {/* Live score pill */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/90 px-2.5 py-1 shrink-0">
            <span
              className={cn(
                "inline-flex size-6 items-center justify-center rounded-lg text-[11px] font-black",
                totals.grade === "A+" || totals.grade === "A"
                  ? "bg-emerald-100 text-emerald-800 glow-grade-emerald"
                  : totals.grade === "B" || totals.grade === "C"
                    ? "bg-blue-100 text-blue-800"
                    : totals.grade === "D"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800",
              )}
            >
              {totals.grade}
            </span>
            <div className="min-w-0">
              <span className="block text-[11px] font-black tabular-nums text-slate-900 leading-tight">
                <AnimatedCounter value={totals.obtainedTotal} />/{totals.grandTotal}
              </span>
              <span className="block text-[10px] font-bold text-blue-900 tabular-nums leading-tight">
                <AnimatedCounter value={totals.percentage} decimals={1} />%
              </span>
            </div>
          </div>

          {/* Share via WhatsApp / Parent Button */}
          <Button
            size="sm"
            onClick={handleSharePdf}
            disabled={busy || hasErrors}
            className="press-card min-h-11 flex-1 gap-1.5 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-700/20 hover:from-emerald-600 hover:to-emerald-500 disabled:opacity-60"
          >
            <Share2 className="size-4 shrink-0" />
            <span>{isSharing ? "Sharing..." : "WhatsApp"}</span>
          </Button>

          {/* Download PDF Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handlePdf}
            disabled={busy || hasErrors}
            className="press-card min-h-11 gap-1.5 rounded-xl border-slate-300 text-xs font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-60 px-3 shrink-0"
          >
            <FileDown className="size-4 shrink-0" />
            <span>PDF</span>
          </Button>

          {nextStudentId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                navigate({ to: "/editor/$studentId", params: { studentId: nextStudentId } })
              }
              className="press-card min-h-11 shrink-0 gap-1 rounded-xl border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              Next <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      ) : null}

      {/* PDF export off-screen container */}
      {isPdfExporting && (
        <div
          ref={exportCardRef}
          className="no-print"
          aria-hidden="true"
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            zIndex: -9999,
            opacity: 0,
            pointerEvents: "none",
          }}
        >
          <div style={{ width: "794px", minHeight: "1123px", background: "#ffffff" }}>
            <ResultCard
              student={student}
              subjects={student.subjects}
              settings={settings}
              includeSummerWork={includeSummerWork}
            />
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  children,
  error,
  required,
}: {
  label: string;
  children: React.ReactNode;
  error?: string | undefined;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      {children}
      {error ? <p className="text-[11px] font-medium text-rose-500">{error}</p> : null}
    </div>
  );
}
