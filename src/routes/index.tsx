import { useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Copy,
  Download,
  FileDown,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Users,
  TrendingUp,
  BookOpen,
  Award,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ResultCard } from "@/components/ResultCard/ResultCard";
import { createStudent, useResultStore } from "@/store/resultStore";
import { calculateTotals } from "@/utils/calculations";
import { generatePdf } from "@/utils/pdf";
import { printDocument } from "@/utils/print";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Students — School Result Card Generator" },
      {
        name: "description",
        content:
          "Manage student records and generate printable A4 progress reports with automatic totals, percentage, and grade.",
      },
    ],
  }),
  component: StudentsPage,
});

function StudentsPage() {
  const { ready, students, settings, addStudent, deleteStudent, deleteStudents, duplicateStudent } =
    useResultStore();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const [sheetStudent, setSheetStudent] = useState<(typeof students)[0] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<(typeof students)[0] | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const isMobile = useIsMobile();

  const bulkPdfRef = useRef<HTMLDivElement>(null);
  const singlePdfRef = useRef<HTMLDivElement>(null);
  const [singleStudentToExport, setSingleStudentToExport] = useState<(typeof students)[0] | null>(
    null,
  );

  const classes = useMemo(
    () => Array.from(new Set(students.map((s) => s.className).filter(Boolean))),
    [students],
  );
  const sessions = useMemo(
    () => Array.from(new Set(students.map((s) => s.session).filter(Boolean))),
    [students],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      const matchesQuery =
        !q ||
        [s.name, s.className, s.rollNumber, s.session, s.section, s.remarks]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matchesClass = classFilter === "all" || s.className === classFilter;
      const matchesSession = sessionFilter === "all" || s.session === sessionFilter;
      return matchesQuery && matchesClass && matchesSession;
    });
  }, [students, query, classFilter, sessionFilter]);

  const selectedStudents = useMemo(
    () => students.filter((s) => selected.includes(s.id)),
    [students, selected],
  );

  const isAllSelected = filtered.length > 0 && filtered.every((s) => selected.includes(s.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      const filteredIds = new Set(filtered.map((s) => s.id));
      setSelected((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      const next = new Set([...selected, ...filtered.map((s) => s.id)]);
      setSelected(Array.from(next));
    }
  };

  const handleCreate = () => {
    const student = createStudent(settings);
    addStudent(student);
    navigate({ to: "/editor/$studentId", params: { studentId: student.id } });
  };

  const handleDuplicate = (id: string) => {
    const copy = duplicateStudent(id);
    if (copy) {
      toast.success(`Created copy of ${copy.name.replace(" (Copy)", "")}`);
    }
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteStudent(pendingDelete.id);
    setSelected((prev) => prev.filter((id) => id !== pendingDelete.id));
    setSheetStudent((prev) => (prev?.id === pendingDelete.id ? null : prev));
    toast.success(`${pendingDelete.name || "Student"} removed`);
    setPendingDelete(null);
  };

  const confirmBulkDelete = () => {
    if (selected.length === 0) return;
    const count = selected.length;
    const selectedSet = new Set(selected);
    deleteStudents(selected);
    setSelected([]);
    setSheetStudent((prev) => (prev && selectedSet.has(prev.id) ? null : prev));
    setBulkDeleteOpen(false);
    toast.success(`${count} student${count > 1 ? "s" : ""} removed`);
  };

  /**
   * Closing the sheet and opening the dialog in the same tick makes Radix and
   * vaul fight over the body scroll lock and focus scope, which can leave the
   * page unscrollable. Wait for the sheet to finish animating out first.
   */
  const requestDelete = (student: (typeof students)[0]) => {
    setSheetStudent(null);
    setTimeout(() => setPendingDelete(student), 300);
  };

  const handleBulkPdf = async () => {
    if (selectedStudents.length === 0) return;
    setBusy(true);
    setProgressText(`Preparing 0 of ${selectedStudents.length}...`);
    try {
      await new Promise((r) => setTimeout(r, 100));
      const nodes = Array.from(
        bulkPdfRef.current?.querySelectorAll<HTMLElement>("[data-result-card]") ?? [],
      );
      if (nodes.length === 0) throw new Error("No cards found to render");
      await generatePdf(
        nodes,
        `Result-Cards-Batch-${selectedStudents.length}-Students.pdf`,
        (current, total) => {
          setProgressText(`Rendering page ${current} of ${total}...`);
        },
      );
      toast.success(`Generated PDF with ${selectedStudents.length} result cards`);
    } catch (err) {
      console.error(err);
      toast.error("Could not generate the bulk PDF. Please try again.");
    } finally {
      setBusy(false);
      setProgressText("");
    }
  };

  const handleBulkPrint = () => {
    if (selectedStudents.length === 0) return;
    setIsBulkPrinting(true);
    setTimeout(() => {
      // Tear down on `afterprint` rather than a fixed delay. A short timer can
      // unmount the cards while the browser is still paginating a large batch,
      // which is what left the last sheets looking truncated. The fallback only
      // covers browsers that never fire the event, so it is generous.
      const done = () => {
        setIsBulkPrinting(false);
        window.removeEventListener("afterprint", done);
      };
      window.addEventListener("afterprint", done);
      window.setTimeout(done, 60_000);
      printDocument();
    }, 200);
  };

  const handleDirectPdf = async (student: (typeof students)[0]) => {
    setSingleStudentToExport(student);
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 100));
      const node = singlePdfRef.current?.querySelector<HTMLElement>("[data-result-card]");
      if (!node) throw new Error("Render target not found");
      await generatePdf(
        [node],
        `${(student.name || "Student").replace(/\s+/g, "-")}-Result-Card.pdf`,
      );
      toast.success(`PDF downloaded for ${student.name}`);
    } catch (err) {
      console.error(err);
      toast.error("Could not generate PDF");
    } finally {
      setBusy(false);
      setSingleStudentToExport(null);
    }
  };

  const stats = useMemo(() => {
    if (students.length === 0) return null;
    const totalsList = students.map((s) =>
      calculateTotals(s.subjects, settings.grades, s.includeSummerWork ?? false),
    );
    const avgPercentage =
      totalsList.reduce((sum, t) => sum + t.percentage, 0) / (totalsList.length || 1);
    const topStudent = [...students].sort((a, b) => {
      const totA = calculateTotals(
        a.subjects,
        settings.grades,
        a.includeSummerWork ?? false,
      ).percentage;
      const totB = calculateTotals(
        b.subjects,
        settings.grades,
        b.includeSummerWork ?? false,
      ).percentage;
      return totB - totA;
    })[0];
    return {
      total: students.length,
      avgPercentage: Math.round(avgPercentage * 10) / 10,
      topStudentName: topStudent?.name || "—",
      topPercentage: topStudent
        ? calculateTotals(
            topStudent.subjects,
            settings.grades,
            topStudent.includeSummerWork ?? false,
          ).percentage
        : 0,
    };
  }, [students, settings.grades]);

  const hasFilters = query || classFilter !== "all" || sessionFilter !== "all";

  return (
    <div className="print-shell mx-auto w-full max-w-6xl px-3.5 pb-24 pt-4 sm:px-6 sm:pb-12 sm:pt-6 animate-fade-in">
      {/* Page Header */}
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-extrabold text-slate-900 sm:text-3xl tracking-tight">
              Students
            </h1>
            {students.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-900 tabular-nums">
                {students.length}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500 hidden sm:block">
            Manage student records and export official progress reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          {students.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelected(students.map((s) => s.id))}
              className="min-h-10 gap-1.5 rounded-xl border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 sm:min-h-9 sm:text-sm"
            >
              <FileDown className="size-3.5 sm:size-4" />
              <span className="hidden sm:inline">Select All for PDF</span>
              <span className="sm:hidden">Select All</span>
            </Button>
          )}
          <Button
            onClick={handleCreate}
            className="min-h-10 gap-1.5 rounded-xl bg-blue-900 text-xs font-bold text-white shadow-sm hover:bg-blue-800 sm:min-h-9 sm:text-sm"
          >
            <Plus className="size-4" />
            Add Student
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats ? (
        <div className="no-print mb-5 grid grid-cols-2 gap-2.5 sm:mb-6 sm:grid-cols-4 sm:gap-3">
          <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-3.5 sm:p-4 shadow-2xs transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 h-[98px] sm:h-28 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Total
              </span>
              <div className="flex size-7 sm:size-8 items-center justify-center rounded-xl bg-slate-100">
                <Users className="size-3.5 sm:size-4 text-slate-600" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">{stats.total}</p>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-slate-300 to-slate-400 rounded-b-2xl" />
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 via-blue-50/40 to-white p-3.5 sm:p-4 shadow-2xs transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 h-[98px] sm:h-28 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
                Average
              </span>
              <div className="flex size-7 sm:size-8 items-center justify-center rounded-xl bg-blue-100">
                <TrendingUp className="size-3.5 sm:size-4 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-blue-800 tabular-nums">{stats.avgPercentage}%</p>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 to-blue-600 rounded-b-2xl" />
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 via-emerald-50/40 to-white p-3.5 sm:p-4 shadow-2xs transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 h-[98px] sm:h-28 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                Top
              </span>
              <div className="flex size-7 sm:size-8 items-center justify-center rounded-xl bg-emerald-100">
                <Award className="size-3.5 sm:size-4 text-emerald-600" />
              </div>
            </div>
            <div>
              <p className="text-sm sm:text-base font-bold text-emerald-800 truncate">
                {stats.topStudentName}
              </p>
              <p className="text-xs font-semibold text-emerald-600 tabular-nums mt-0.5">{stats.topPercentage}%</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-b-2xl" />
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/80 via-violet-50/40 to-white p-3.5 sm:p-4 shadow-2xs transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 h-[98px] sm:h-28 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">
                Exam
              </span>
              <div className="flex size-7 sm:size-8 items-center justify-center rounded-xl bg-violet-100">
                <BookOpen className="size-3.5 sm:size-4 text-violet-600" />
              </div>
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-violet-800 leading-snug truncate">
                {settings.defaultTerm}
              </p>
              <p className="text-[11px] text-violet-500 mt-0.5 truncate">{settings.defaultSession}</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-400 to-violet-600 rounded-b-2xl" />
          </div>
        </div>
      ) : null}

      {/* Search & Filter Bar */}
      <div className="no-print mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="h-10 sm:h-11 rounded-xl bg-white pl-9 pr-10 text-sm placeholder:text-slate-400 border-slate-200 shadow-2xs focus-visible:ring-blue-500/30"
            placeholder="Search students by name, class or remarks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {(classes.length > 1 || sessions.length > 1 || hasFilters) && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            {classes.length > 1 && (
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-xs sm:text-sm font-medium shadow-2xs sm:w-[130px]">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls} value={cls}>
                      Class {cls}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {sessions.length > 1 && (
              <Select value={sessionFilter} onValueChange={setSessionFilter}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-xs sm:text-sm font-medium shadow-2xs sm:w-[150px]">
                  <SelectValue placeholder="All Sessions" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Sessions</SelectItem>
                  {sessions.map((sess) => (
                    <SelectItem key={sess} value={sess}>
                      {sess}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setClassFilter("all");
                  setSessionFilter("all");
                }}
                className="col-span-2 sm:col-span-1 h-9 rounded-xl gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                <X className="size-3.5" /> Clear Filters
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selected.length > 0 && (
        <div className="no-print mb-4 flex flex-col gap-3 rounded-2xl border border-blue-900/10 bg-gradient-to-r from-blue-950 to-slate-900 p-3 sm:px-4 sm:py-3.5 shadow-xl shadow-slate-900/15 sm:flex-row sm:items-center sm:justify-between animate-slide-down">
          {/* Status + Clear button on mobile */}
          <div className="flex items-center justify-between sm:justify-start gap-2.5">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-white/20 text-xs font-black text-white">
                {selected.length}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white/90">
                {selected.length} student{selected.length > 1 ? "s" : ""} selected
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected([])}
              disabled={busy}
              className="h-8 px-2.5 text-xs text-white/70 hover:bg-white/10 hover:text-white sm:hidden"
            >
              <X className="mr-1 size-3.5" /> Clear
            </Button>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected([])}
              disabled={busy}
              className="hidden sm:inline-flex h-8 text-xs text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="mr-1 size-3.5" /> Clear
            </Button>
            {!isMobile && (
              <Button
                size="sm"
                onClick={handleBulkPrint}
                disabled={busy}
                className="h-8 gap-1.5 border border-white/20 bg-white/10 text-xs text-white hover:bg-white/20"
              >
                <Printer className="size-3.5" /> Print ({selected.length})
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleBulkPdf}
              disabled={busy}
              className="min-h-10 sm:min-h-8 gap-1.5 bg-white text-xs font-bold text-slate-900 shadow-sm hover:bg-slate-100"
            >
              <FileDown className="size-3.5 shrink-0" />
              <span className="truncate">
                {busy ? progressText || "Generating..." : `Download PDF`}
              </span>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={busy}
              className="min-h-10 sm:min-h-8 gap-1.5 bg-rose-600 text-xs font-bold text-white hover:bg-rose-700"
            >
              <Trash2 className="size-3.5 shrink-0" />
              <span className="truncate">Delete ({selected.length})</span>
            </Button>
          </div>
        </div>
      )}

      {/* Student Table */}
      <div className="no-print overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {!ready ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
            <div className="relative size-12">
              <div className="size-12 rounded-full border-4 border-slate-100" />
              <div className="absolute inset-0 size-12 rounded-full border-4 border-transparent border-t-blue-600 animate-spin" />
            </div>
            <p className="text-sm font-medium">Loading students...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-5 px-6 text-center">
            <div className="flex size-20 items-center justify-center rounded-3xl bg-slate-100">
              <Users className="size-10 text-slate-300" />
            </div>
            <div>
              <p className="text-lg font-extrabold text-slate-800">
                {students.length === 0 ? "No students yet" : "No matching students"}
              </p>
              <p className="text-sm text-slate-500 mt-1.5 max-w-[280px] mx-auto">
                {students.length === 0
                  ? "Add your first student to get started generating result cards."
                  : "Try adjusting your search or filters."}
              </p>
            </div>
            {students.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  setQuery("");
                  setClassFilter("all");
                  setSessionFilter("all");
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    <th className="w-12 px-3 py-4 text-center sm:w-10 sm:px-4">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                        className="size-5"
                      />
                    </th>
                    <th className="px-2 py-4 sm:px-4">Student</th>
                    <th className="hidden px-4 py-4 text-center md:table-cell">Class</th>
                    <th className="hidden px-4 py-4 text-center md:table-cell">Marks</th>
                    <th className="hidden px-4 py-4 text-center md:table-cell">%</th>
                    <th className="px-2 py-4 text-center sm:px-4">Grade</th>
                    <th className="w-14 px-2 py-4 text-right sm:w-auto sm:px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((student, rowIndex) => {
                    const totals = calculateTotals(
                      student.subjects,
                      settings.grades,
                      student.includeSummerWork ?? false,
                    );
                    const isSelected = selected.includes(student.id);
                    const isTopGrade = totals.grade === "A+" || totals.grade === "A";
                    const isLowGrade = totals.grade === "F" || totals.grade === "E";
                    const avatarColors = [
                      "from-blue-700 to-blue-900",
                      "from-violet-700 to-violet-900",
                      "from-emerald-700 to-emerald-900",
                      "from-amber-600 to-amber-800",
                      "from-rose-700 to-rose-900",
                      "from-cyan-700 to-cyan-900",
                    ];
                    const avatarColor = avatarColors[rowIndex % avatarColors.length];

                    return (
                      <tr
                        key={student.id}
                        onClick={() =>
                          navigate({
                            to: "/editor/$studentId",
                            params: { studentId: student.id },
                          })
                        }
                        className={`group cursor-pointer transition-colors active:bg-blue-50/70 hover:bg-blue-50/40 ${
                          isSelected ? "bg-blue-50/50" : ""
                        }`}
                      >
                        <td
                          className="w-11 px-2.5 py-3.5 text-center sm:w-10 sm:px-4 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected((prev) =>
                              isSelected
                                ? prev.filter((id) => id !== student.id)
                                : [...prev, student.id],
                            );
                          }}
                        >
                          <Checkbox
                            checked={isSelected}
                            aria-label={`Select ${student.name || "student"}`}
                            className="size-5 pointer-events-none"
                          />
                        </td>

                        <td className="px-2 py-3 sm:px-4 sm:py-3.5">
                          <div className="flex items-center gap-2.5 sm:gap-3">
                            {/* Avatar */}
                            <div
                              className={`flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${avatarColor} text-xs font-black text-white shadow-sm`}
                            >
                              {(student.name || "?")[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="block max-w-full truncate text-left font-bold text-slate-900 transition-colors group-hover:text-blue-900">
                                {student.name || "Untitled Student"}
                              </span>

                              {/* Mobile-only summary chips */}
                              <div className="mt-1 flex flex-wrap items-center gap-1 md:hidden">
                                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                                  {student.className || "—"}
                                </span>
                                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
                                  {totals.obtainedTotal}/{totals.grandTotal}
                                </span>
                                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
                                  {totals.percentage}%
                                </span>
                              </div>

                              {student.remarks && (
                                <p className="mt-0.5 hidden max-w-[220px] truncate text-xs italic text-slate-400 sm:block sm:max-w-[320px]">
                                  &ldquo;{student.remarks}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="hidden px-4 py-3.5 text-center md:table-cell">
                          <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                            {student.className || "—"}
                          </span>
                        </td>

                        <td className="hidden whitespace-nowrap px-4 py-3.5 text-center md:table-cell">
                          <span className="font-bold text-slate-800">{totals.obtainedTotal}</span>
                          <span className="text-xs text-slate-400"> / {totals.grandTotal}</span>
                        </td>

                        <td className="hidden whitespace-nowrap px-4 py-3.5 text-center font-bold text-slate-800 md:table-cell">
                          {totals.percentage}%
                        </td>

                        <td className="px-2 py-3 text-center sm:px-4 sm:py-3.5">
                          <span
                            className={`inline-flex items-center justify-center rounded-lg px-2.5 py-0.5 text-xs font-black ${
                              isTopGrade
                                ? "bg-emerald-100 text-emerald-700"
                                : isLowGrade
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {totals.grade}
                          </span>
                        </td>

                        <td
                          className="px-2 py-3 sm:px-4 sm:py-3.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Mobile: single trigger opens the action sheet */}
                          <button
                            onClick={() => setSheetStudent(student)}
                            aria-label={`Actions for ${student.name || "student"}`}
                            className="flex size-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 md:hidden"
                          >
                            <MoreHorizontal className="size-5" />
                          </button>

                          {/* Desktop: full inline actions */}
                          <div className="hidden items-center justify-end gap-0.5 md:flex">
                            <button
                              title="Edit"
                              aria-label="Edit"
                              onClick={() =>
                                navigate({
                                  to: "/editor/$studentId",
                                  params: { studentId: student.id },
                                })
                              }
                              className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-700"
                            >
                              <Pencil className="size-3.5" />
                            </button>

                            <button
                              title="Download PDF"
                              aria-label="Download PDF"
                              disabled={busy}
                              onClick={() => handleDirectPdf(student)}
                              className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40"
                            >
                              <Download className="size-3.5" />
                            </button>

                            <button
                              title="Print"
                              aria-label="Print"
                              onClick={() =>
                                navigate({
                                  to: "/editor/$studentId",
                                  params: { studentId: student.id },
                                  search: { print: true },
                                })
                              }
                              className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-700"
                            >
                              <Printer className="size-3.5" />
                            </button>

                            <button
                              title="Duplicate"
                              aria-label="Duplicate"
                              onClick={() => handleDuplicate(student.id)}
                              className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Copy className="size-3.5" />
                            </button>

                            <button
                              title="Delete"
                              aria-label="Delete"
                              onClick={() => setPendingDelete(student)}
                              className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-xs font-medium text-slate-400">
              Showing {filtered.length} of {students.length} student
              {students.length !== 1 ? "s" : ""}
              {hasFilters && " (filtered)"}
            </div>
          </>
        )}
      </div>

      {/* Bulk Print container */}
      {isBulkPrinting && (
        <div className="print-root print-only print-root--multi">
          {selectedStudents.map((student) => (
            <ResultCard
              key={student.id}
              student={student}
              settings={settings}
              includeSummerWork={student.includeSummerWork ?? false}
            />
          ))}
        </div>
      )}

      {/* Bulk PDF off-screen render */}
      {/*
       * Off-screen render targets for html2canvas. `no-print` keeps them out of
       * the printed layout: they are `position: fixed, opacity: 0`, but their
       * cards still carry `break-after: page` and so could contribute page
       * breaks of their own. Only `@media print` is affected, and the PDF
       * export runs in screen media, so capture is unaffected.
       */}
      <div
        ref={bulkPdfRef}
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
        {selectedStudents.map((student) => (
          <div key={student.id} style={{ width: "794px", minHeight: "1123px", background: "#fff" }}>
            <ResultCard
              student={student}
              settings={settings}
              includeSummerWork={student.includeSummerWork ?? false}
            />
          </div>
        ))}
      </div>

      {/* Single PDF off-screen render */}
      {singleStudentToExport && (
        <div
          ref={singlePdfRef}
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
          <div style={{ width: "794px", minHeight: "1123px", background: "#fff" }}>
            <ResultCard
              student={singleStudentToExport}
              settings={settings}
              includeSummerWork={singleStudentToExport.includeSummerWork ?? false}
            />
          </div>
        </div>
      )}

      {/* Mobile action sheet */}
      <Drawer
        open={sheetStudent !== null}
        onOpenChange={(open) => {
          if (!open) setSheetStudent(null);
        }}
      >
        <DrawerContent className="bg-white pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {sheetStudent
            ? (() => {
                const totals = calculateTotals(
                  sheetStudent.subjects,
                  settings.grades,
                  sheetStudent.includeSummerWork ?? false,
                );
                return (
                  <>
                    {/* Drag handle */}
                    <div className="mx-auto mt-2 mb-4 h-1 w-10 rounded-full bg-slate-200" />
                    <DrawerTitle className="px-5 text-left text-base font-extrabold text-slate-900">
                      {sheetStudent.name || "Untitled Student"}
                    </DrawerTitle>
                    <DrawerDescription className="px-5 mt-1 text-left text-xs text-slate-500">
                      {sheetStudent.className || "—"} &middot; {totals.obtainedTotal}/
                      {totals.grandTotal} &middot; {totals.percentage}% &middot; Grade{" "}
                      <span
                        className={`font-bold ${
                          totals.grade === "A+" || totals.grade === "A"
                            ? "text-emerald-600"
                            : totals.grade === "F" || totals.grade === "E"
                              ? "text-rose-600"
                              : "text-amber-600"
                        }`}
                      >
                        {totals.grade}
                      </span>
                    </DrawerDescription>

                    <div className="mt-4 flex flex-col border-t border-slate-100">
                      <SheetAction
                        icon={<Pencil className="size-4" />}
                        label="Edit Marks"
                        onClick={() =>
                          navigate({
                            to: "/editor/$studentId",
                            params: { studentId: sheetStudent.id },
                          })
                        }
                      />
                      <SheetAction
                        icon={<Download className="size-4" />}
                        label="Download PDF"
                        disabled={busy}
                        onClick={() => handleDirectPdf(sheetStudent)}
                      />
                      <SheetAction
                        icon={<Copy className="size-4" />}
                        label="Duplicate Student"
                        onClick={() => handleDuplicate(sheetStudent.id)}
                      />
                      <SheetAction
                        icon={<Trash2 className="size-4" />}
                        label="Delete Student"
                        destructive
                        onClick={() => requestDelete(sheetStudent)}
                      />
                    </div>
                  </>
                );
              })()
            : null}
        </DrawerContent>
      </Drawer>

      {/* Delete confirmation */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-extrabold">
              Delete this student?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name || "This student"} and all their marks will be permanently
              removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="min-h-11 rounded-xl bg-rose-600 text-white hover:bg-rose-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete confirmation */}
      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (!open) setBulkDeleteOpen(false);
        }}
      >
        <AlertDialogContent className="rounded-2xl max-w-[calc(100%-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-extrabold">
              Delete {selected.length} {selected.length > 1 ? "students" : "student"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selected.length === 1
                ? "This student and all their marks will be permanently removed. This cannot be undone."
                : `All ${selected.length} selected students and their marks will be permanently removed. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="min-h-11 rounded-xl bg-rose-600 text-white hover:bg-rose-700"
            >
              Delete {selected.length} {selected.length > 1 ? "Students" : "Student"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SheetAction({
  icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <DrawerClose asChild>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`flex min-h-14 w-full items-center gap-3.5 px-5 text-left text-[15px] font-semibold transition-colors disabled:opacity-40 ${
          destructive
            ? "text-rose-600 hover:bg-rose-50 active:bg-rose-100"
            : "text-slate-800 hover:bg-slate-50 active:bg-slate-100"
        }`}
      >
        <span className={destructive ? "text-rose-400" : "text-slate-400"}>{icon}</span>
        {label}
      </button>
    </DrawerClose>
  );
}

