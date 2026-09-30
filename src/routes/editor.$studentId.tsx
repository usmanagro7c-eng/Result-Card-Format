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
import { generatePdf } from "@/utils/pdf";
import { printDocument } from "@/utils/print";
import { GradeText } from "@/utils/raisedText";
import { DEFAULT_FIT_STATE, type CardFitState } from "@/hooks/useCardFit";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/editor/$studentId")({
  validateSearch: (search: Record<string, unknown>): { print?: true | undefined } => ({
    print: search["print"] === true || search["print"] === "true" ? true : undefined,
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

function ResultEditor() {
  const { studentId } = Route.useParams();
  const { print } = Route.useSearch();
  const navigate = useNavigate();
  const { ready, students, getStudent, updateStudent, settings, storageFull } = useResultStore();

  const student = getStudent(studentId);
  const cardRef = useRef<HTMLDivElement>(null);
  const exportCardRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [fitState, setFitState] = useState<CardFitState>(DEFAULT_FIT_STATE);
  const printed = useRef(false);

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
  const [mobileTab, setMobileTab] = useState<"form" | "preview">("form");

  // The A4 card lives in the preview panel, which is display:none while the
  // Form tab is active. Force the preview visible for any print path, whether
  // it comes from the ?print= param or the browser's own Ctrl/Cmd+P.
  useEffect(() => {
    const revealPreview = () => setMobileTab("preview");
    window.addEventListener("beforeprint", revealPreview);
    return () => window.removeEventListener("beforeprint", revealPreview);
  }, []);

  useEffect(() => {
    if (print) setMobileTab("preview");
  }, [print]);

  if (!ready) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-4 py-32 text-center">
        <div className="relative size-12">
          <div className="size-12 rounded-full border-4 border-slate-100" />
          <div className="absolute inset-0 size-12 rounded-full border-4 border-transparent border-t-blue-600 animate-spin" />
        </div>
        <p className="text-sm font-medium text-slate-500">Loading result card...</p>
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

  const handlePdf = async () => {
    const target =
      (exportCardRef.current?.firstElementChild as HTMLElement | null) || cardRef.current;
    if (!target) return;
    setBusy(true);
    try {
      const fileName = `${(student.name || "Student").replace(/\s+/g, "-")}-Result-Card.pdf`;
      await generatePdf([target], fileName);
      toast.success("PDF downloaded successfully");
    } catch (err) {
      console.error(err);
      toast.error("Could not generate the PDF. Please try again.");
    } finally {
      setBusy(false);
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
    <div className="print-shell mx-auto w-full max-w-7xl px-3 pb-6 pt-3 sm:px-6 sm:pb-12 sm:pt-4">
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
                size="sm"
                onClick={handlePdf}
                disabled={busy || hasErrors}
                className="min-h-9 gap-1.5 bg-blue-900 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
              >
                <FileDown className="size-4" />
                {busy ? "Preparing..." : "Download PDF"}
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
            <span className="font-semibold">Browser storage is full — changes are not being saved.</span>{" "}
            Remove a few student photos or delete a student to free space, then reload this page.
          </p>
        </div>
      ) : null}

      {/* Cannot-fit Warning */}
      {fitState.cannotFit ? (
        <div className="no-print mb-4 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900">
          <TriangleAlert className="size-4 shrink-0 text-amber-500" />
          <p>
            Card is ~{Math.max(1, Math.round(fitState.overMm))}mm too tall for 1 page. Reduce subjects or remarks to fit.
          </p>
        </div>
      ) : null}

      {/* Mobile Panel Switcher */}
      <div
        className={cn(
          "no-print mb-4 grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1",
          !isMobile && "hidden",
        )}
        role="tablist"
        aria-label="Editor panels"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "form"}
          onClick={() => setMobileTab("form")}
          className={cn(
            "flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all",
            mobileTab === "form"
              ? "bg-white text-blue-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          <Pencil className="size-4" /> Form
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "preview"}
          onClick={() => setMobileTab("preview")}
          className={cn(
            "flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all",
            mobileTab === "preview"
              ? "bg-white text-blue-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          <Eye className="size-4" /> Preview
        </button>
      </div>

      {/* Main Two-Column Grid */}
      <div className="grid gap-5 lg:grid-cols-12 items-start">
        {/* ── Left Column: Form ── */}
        <div
          className={cn(
            "no-print space-y-4 lg:col-span-6 lg:block xl:col-span-5",
            isMobile && (mobileTab === "form" ? "block" : "hidden"),
          )}
        >
          {/* ── Student Info Card ── */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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

          {/* ── Subject Marks Card ── */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                    {item.raiseSign ? <GradeText text={String(item.value)} /> : item.value}
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

          {/* ── Remarks Card ── */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
            </div>
          </div>
        </div>

        {/* ── Right Column: Live Preview ── */}
        <div
          className={cn(
            "print-root lg:sticky lg:top-[5rem] lg:col-span-6 lg:block xl:col-span-7",
            isMobile && (mobileTab === "preview" ? "block" : "hidden"),
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
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    totals.grade === "A+" || totals.grade === "A"
                      ? "bg-emerald-100 text-emerald-700"
                      : totals.grade === "F" || totals.grade === "E"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {totals.percentage}% · {totals.grade}
                </span>
              </div>
            </div>
            <div className="a4-chrome p-1.5 sm:p-4">
              <ResultPreview key={mobileTab} printerMarginMm={settings.printerMarginMm}>
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

      {/* Mobile Sticky Bottom Bar */}
      {isMobile ? (
        <div
          className="no-print sticky bottom-0 z-30 -mx-4 mt-4 flex items-center gap-2.5 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md"
          style={{
            paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
            boxShadow: "0 -4px 20px -4px rgb(15 23 42 / 0.12)",
          }}
        >
          {/* Live score */}
          <div className="min-w-0 shrink-0">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Score
            </span>
            <span className="block text-sm font-black tabular-nums text-slate-900">
              {totals.obtainedTotal}/{totals.grandTotal}
              <span className="ml-1.5 text-xs font-bold text-blue-700">{totals.percentage}%</span>
            </span>
          </div>

          <Button
            size="sm"
            onClick={handlePdf}
            disabled={busy || hasErrors}
            className="min-h-11 flex-1 gap-1.5 bg-blue-900 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            <FileDown className="size-4" />
            {busy ? "Preparing..." : (
              <>
                <span className="hidden min-[360px]:inline">Download </span>PDF
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={!nextStudentId}
            onClick={() =>
              nextStudentId &&
              navigate({ to: "/editor/$studentId", params: { studentId: nextStudentId } })
            }
            className="min-h-11 shrink-0 gap-1 border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : null}

      {/* PDF export off-screen container */}
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
    </div>
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
