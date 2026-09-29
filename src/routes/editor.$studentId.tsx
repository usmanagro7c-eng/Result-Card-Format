import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
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
      <div className="px-4 py-24 text-center text-sm text-muted-foreground">
        Loading student result card...
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
    <div className="print-shell mx-auto w-full max-w-7xl px-4 pb-12 pt-4 sm:px-6">
      {/* Top Action Bar */}
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="min-h-11 gap-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:min-h-9"
          >
            <Link to="/">
              <ArrowLeft className="size-4" /> Back
            </Link>
          </Button>

          {totalStudents > 1 && currentIndex >= 0 ? (
            <div className="flex items-center gap-0.5 border-l border-slate-200 pl-2">
              <span className="mr-0.5 hidden text-xs text-slate-400 min-[380px]:inline">
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
          <div className="hidden items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-600 md:flex">
            <FileCheck2 className="size-3.5" />
            <span>Auto-saved</span>
          </div>

          {/* On mobile the sticky bottom bar owns both actions: window.print()
              is a no-op in Android Chrome, and a duplicate PDF button here
              would just repeat the one already pinned to the bottom. */}
          {!isMobile && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={printDocument}
                className="min-h-9 gap-1.5 border-slate-300 text-sm text-slate-700 hover:bg-slate-100"
              >
                <Printer className="size-4" />
                Print
              </Button>

              <Button
                size="sm"
                onClick={handlePdf}
                disabled={busy || hasErrors}
                className="min-h-9 gap-1.5 bg-slate-900 text-sm text-white shadow-sm hover:bg-slate-800"
              >
                <FileDown className="size-4" />
                {busy ? "Preparing..." : "Download PDF"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Autosave actually failed, so the "Auto-saved" badge above is lying.
          Without this the teacher would only discover it after leaving the page. */}
      {storageFull ? (
        <div className="no-print mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p className="leading-snug">
            <span className="font-semibold">
              Browser storage is full — changes are not being saved.
            </span>{" "}
            Remove a few student photos or delete a student to free space, then reload this page.
          </p>
        </div>
      ) : null}

      {/* Mobile panel switcher — one panel at a time instead of a long stacked scroll */}
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
            "flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors",
            mobileTab === "form"
              ? "bg-white text-slate-900 shadow-sm"
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
            "flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors",
            mobileTab === "preview"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          <Eye className="size-4" /> Preview
        </button>
      </div>

      {/* Main Two-Column Grid */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Form */}
        <div
          className={cn(
            "no-print space-y-5 lg:col-span-6 lg:block xl:col-span-5",
            isMobile && (mobileTab === "form" ? "block" : "hidden"),
          )}
        >
          {/* Student Info Card */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3.5 flex items-center gap-2">
              <div className="size-5 rounded-md bg-slate-900 flex items-center justify-center">
                <span className="text-[10px] text-white font-bold">S</span>
              </div>
              <h2 className="text-sm font-semibold text-slate-800">Student Information</h2>
            </div>
            <div className="p-5 grid gap-4 sm:grid-cols-2">
              <Field
                label="Student Name"
                required
                error={!student.name.trim() ? "Name is required" : undefined}
              >
                <Input
                  value={student.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="e.g. Usman Amjad"
                  className={`bg-slate-50/50 border-slate-200 focus-visible:bg-white ${
                    !student.name.trim() ? "border-rose-400 focus-visible:ring-rose-300" : ""
                  }`}
                />
              </Field>

              <Field label="Class">
                <Input
                  value={student.className}
                  onChange={(e) => set({ className: e.target.value })}
                  placeholder="e.g. 10th"
                  className="bg-slate-50/50 border-slate-200 focus-visible:bg-white"
                />
              </Field>
            </div>

            {/* Photo is opt-in per student: off means the card renders exactly as
                it did before photos existed, and no empty box is left behind. */}
            <div className="border-t border-slate-100 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label
                    htmlFor="show-photo"
                    className="text-sm font-semibold text-slate-800 cursor-pointer"
                  >
                    Show photo on result card
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Adds a small photo box beside the Progress Report heading.
                  </p>
                </div>
                <Switch
                  id="show-photo"
                  checked={student.showPhoto ?? false}
                  onCheckedChange={(checked) => set({ showPhoto: checked })}
                  aria-label="Show photo on result card"
                />
              </div>

              {student.showPhoto ? (
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex h-[74px] w-[56px] shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-slate-300 bg-slate-50">
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
                    {/*
                     * Spells out the print size rather than saying "passport
                     * size", which it is not: 21x28mm is smaller than the common
                     * 35x45mm and 38x25mm ID specs. The preview box here is 3:4
                     * (0.757) and the card box is exactly 3:4 (0.75), so what is
                     * shown here is what prints, and a 3:4 portrait photo is the
                     * one that needs no cropping at all.
                     */}
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      A portrait 3:4 photo works best. Square or landscape photos get cropped to fit
                      the box. The photo prints at 21×28mm on the card, and the upload is resized
                      automatically so it does not fill up your browser storage.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Subjects Card */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-5 rounded-md bg-blue-600 flex items-center justify-center">
                  <span className="text-[10px] text-white font-bold">M</span>
                </div>
                <h2 className="text-sm font-semibold text-slate-800">Subject Marks</h2>
              </div>
              <span className="text-xs font-medium text-slate-400 bg-slate-100 rounded-full px-2.5 py-0.5">
                {student.subjects.length} subject{student.subjects.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="p-5">
              <SubjectTable
                subjects={student.subjects}
                onChange={(subjects) => set({ subjects })}
                includeSummerWork={includeSummerWork}
                onIncludeSummerWorkChange={(value) => set({ includeSummerWork: value })}
              />
            </div>

            {/* Results Summary Strip */}
            <div className="border-t border-slate-100 grid grid-cols-4 divide-x divide-slate-100 bg-slate-50">
              {[
                { label: "Total", value: totals.grandTotal },
                { label: "Obtained", value: totals.obtainedTotal },
                { label: "Percentage", value: `${totals.percentage}%` },
                { label: "Grade", value: totals.grade, highlight: true },
              ].map((item) => (
                <div key={item.label} className="px-3 py-3 text-center">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                    {item.label}
                  </span>
                  <span
                    className={`text-lg font-black ${item.highlight ? "text-slate-900" : "text-slate-700"}`}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            {hasErrors && (
              <div className="border-t border-rose-100 bg-rose-50 px-5 py-2.5">
                <p className="text-xs font-medium text-rose-600">
                  ⚠️ Fix mark errors above before printing or downloading PDF.
                </p>
              </div>
            )}
          </div>

          {/* Remarks Card */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3.5 flex items-center gap-2">
              <div className="size-5 rounded-md bg-amber-500 flex items-center justify-center">
                <Sparkles className="size-3 text-white" />
              </div>
              <h2 className="text-sm font-semibold text-slate-800">Remarks</h2>
            </div>
            <div className="p-5 space-y-3">
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
                className="resize-none border-slate-200 bg-slate-50/50 focus-visible:bg-white text-sm"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Live Preview */}
        <div
          className={cn(
            "print-root lg:sticky lg:top-20 lg:col-span-6 lg:block xl:col-span-7",
            isMobile && (mobileTab === "preview" ? "block" : "hidden"),
          )}
        >
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="no-print border-b border-slate-100 px-5 py-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Live Preview
              </span>
              <span className="text-[11px] text-slate-400 bg-slate-100 rounded-full px-2.5 py-0.5">
                A4 Portrait
              </span>
            </div>
            <div className="a4-chrome p-4">
              <ResultPreview>
                <ResultCard
                  ref={cardRef}
                  student={student}
                  subjects={student.subjects}
                  settings={settings}
                  includeSummerWork={includeSummerWork}
                />
              </ResultPreview>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky mobile action bar — keeps PDF + "next student" reachable while
          entering marks deep in the form, without scrolling back to the top. */}
      {isMobile ? (
        <div
          className="no-print sticky bottom-0 z-30 -mx-4 mt-4 flex items-center gap-2 border-t border-slate-200 bg-white/95 px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] backdrop-blur-md"
          style={{ boxShadow: "0 -4px 16px -8px rgb(15 23 42 / 0.18)" }}
        >
          <div className="min-w-0 shrink-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Total
            </span>
            <span className="block text-sm font-black tabular-nums text-slate-900">
              {totals.obtainedTotal}/{totals.grandTotal}
              <span className="ml-1.5 text-xs font-bold text-slate-500">{totals.percentage}%</span>
            </span>
          </div>

          <Button
            size="sm"
            onClick={handlePdf}
            disabled={busy || hasErrors}
            className="min-h-11 flex-1 gap-1.5 bg-slate-900 text-sm text-white hover:bg-slate-800"
          >
            <FileDown className="size-4" />
            {busy ? "Preparing..." : "PDF"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={!nextStudentId}
            onClick={() =>
              nextStudentId &&
              navigate({ to: "/editor/$studentId", params: { studentId: nextStudentId } })
            }
            className="min-h-11 shrink-0 gap-1 border-slate-300 text-sm text-slate-700 hover:bg-slate-100"
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : null}

      {/* PDF export off-screen container */}
      <div
        ref={exportCardRef}
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
