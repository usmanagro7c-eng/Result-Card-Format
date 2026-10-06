import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  Check,
  GraduationCap,
  Image as ImageIcon,
  Lock,
  Minus,
  PenTool,
  Plus,
  Printer,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DEFAULT_GRADES } from "@/utils/grading";
import {
  DEFAULT_PRINTER_MARGIN_MM,
  PRINTER_MARGIN_OPTIONS,
  normalizePrinterMarginMm,
} from "@/lib/cardGeometry";
import {
  DEFAULT_SETTINGS,
  DEFAULT_SUBJECTS,
  FIXED_SCHOOL_LOGO,
  FIXED_SCHOOL_NAME,
  FIXED_SCHOOL_TAGLINE,
  uid,
  useResultStore,
} from "@/store/resultStore";
import { capitalizeFirstLetter, cn } from "@/lib/utils";
import type { GradeRule } from "@/types/result";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings & System — The Country School Result Card Generator" },
      {
        name: "description",
        content:
          "Configure school branding, logo, signature uploads, grading thresholds, and default class subjects.",
      },
      { property: "og:title", content: "Settings & System — School Result Card Generator" },
      {
        property: "og:description",
        content: "Configure school branding, default subjects, and grading thresholds.",
      },
    ],
  }),
  component: SettingsPage,
});

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

type SettingsTab = "school" | "grading" | "subjects" | "margins";

const SETTINGS_TABS = [
  {
    id: "school" as const,
    label: "School Info",
    shortLabel: "School",
    icon: Building2,
  },
  {
    id: "grading" as const,
    label: "Grading Scale",
    shortLabel: "Grading",
    icon: GraduationCap,
  },
  {
    id: "subjects" as const,
    label: "Default Subjects",
    shortLabel: "Subjects",
    icon: PenTool,
  },
  {
    id: "margins" as const,
    label: "Printer Margins",
    shortLabel: "Margins",
    icon: Printer,
  },
];

const PRESET_SESSIONS = ["2026–2027", "2025–2026", "2027–2028"];
const PRESET_TERMS = [
  "1st Term Examination",
  "Mid Term Examination",
  "Final Term Examination",
  "Send-Up Examination",
];

const getGradeBadgeStyle = (name: string) => {
  const upper = name.trim().toUpperCase();
  if (upper.startsWith("A")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-300 ring-emerald-500/10";
  }
  if (upper.startsWith("B") || upper.startsWith("C")) {
    return "bg-sky-50 text-sky-700 border-sky-300 ring-sky-500/10";
  }
  if (upper.startsWith("D")) {
    return "bg-amber-50 text-amber-700 border-amber-300 ring-amber-500/10";
  }
  if (upper.startsWith("E") || upper.startsWith("F")) {
    return "bg-rose-50 text-rose-700 border-rose-300 ring-rose-500/10";
  }
  return "bg-slate-50 text-slate-700 border-slate-300 ring-slate-500/10";
};

function SettingsPage() {
  const { ready, settings, updateSettings } = useResultStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>("school");

  if (!ready) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-4 py-32 text-center">
        <div className="relative size-12">
          <div className="size-12 rounded-full border-4 border-slate-100" />
          <div className="absolute inset-0 size-12 rounded-full border-4 border-transparent border-t-blue-600 animate-spin" />
        </div>
        <p className="text-sm font-medium text-slate-500">Loading settings...</p>
      </div>
    );
  }

  const setGrades = (grades: GradeRule[]) => updateSettings({ grades });

  const upload = async (file: File | undefined, key: keyof typeof settings) => {
    if (!file) return;
    try {
      const dataUrl = await readImage(file);
      updateSettings({ [key]: dataUrl } as never);
      toast.success("Image uploaded successfully");
    } catch {
      toast.error("Could not read image file. Please upload PNG or JPEG.");
    }
  };

  const handleResetGrading = () => {
    setGrades(DEFAULT_GRADES);
    toast.success("Grading scale reset to standard (A+, A, B, C, D, E, F)");
  };

  const handleResetSubjects = () => {
    updateSettings({ defaultSubjects: DEFAULT_SUBJECTS });
    toast.success("Default subjects reset to standard (495 Marks)");
  };

  const handleRestoreAllDefaults = () => {
    updateSettings(DEFAULT_SETTINGS);
    toast.success("All settings restored to factory defaults");
  };

  const defaultTotalMarks = settings.defaultSubjects.reduce(
    (sum, s) => sum + (Number(s.totalMarks) || 0),
    0,
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-3 pt-3 pb-32 sm:px-6 sm:py-8 sm:pb-20 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="press-card min-h-10 gap-1.5 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-bold"
          >
            <Link to="/">
              <ArrowLeft className="size-4" />
              <span className="text-xs sm:text-sm">Students</span>
            </Link>
          </Button>
          <div className="h-4 w-px bg-slate-200" />
          <h1 className="text-lg font-black tracking-tight text-slate-900 sm:text-2xl">
            Settings
          </h1>
        </div>

        {/* Restore All Defaults Modal */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="press-card gap-1.5 rounded-xl border-slate-300 text-xs font-bold text-slate-600 shadow-2xs hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
            >
              <RotateCcw className="size-3.5" />
              <span className="hidden sm:inline">Restore All Defaults</span>
              <span className="sm:hidden">Reset</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-2xl max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-extrabold text-slate-900">
                Restore All Defaults?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs leading-relaxed text-slate-600">
                This will reset your default academic session, grading thresholds, printer margins,
                and default class subjects back to factory settings. Any uploaded signatures will
                also be cleared.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-2 flex-row gap-2 justify-end">
              <AlertDialogCancel className="rounded-xl mt-0 font-bold">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRestoreAllDefaults}
                className="rounded-xl bg-rose-600 font-bold text-white hover:bg-rose-700"
              >
                Restore Defaults
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Segmented Navigation Tab Strip (Single Row on Mobile) */}
      <div className="mt-3.5 sm:mt-5">
        <div
          role="tablist"
          aria-label="Settings categories"
          className="grid grid-cols-4 gap-1 rounded-2xl border border-slate-200/90 bg-slate-100/90 p-1 shadow-inner"
        >
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "press-card flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-xs font-extrabold transition-all sm:min-h-10 sm:flex-row sm:gap-2 sm:px-3",
                  isActive
                    ? "bg-white text-blue-950 shadow-xs ring-1 ring-slate-900/5"
                    : "text-slate-500 hover:bg-white/50 hover:text-slate-900",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    isActive ? "text-blue-900" : "text-slate-400",
                  )}
                />
                <span className="truncate text-[11px] sm:text-xs">
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 sm:mt-6">
        {/* ── Tab 1: School Information & Branding ── */}
        {activeTab === "school" && (
          <div className="space-y-4 animate-fade-in">
            {/* Official School Branding Card */}
            <section className="overflow-hidden rounded-2xl border border-blue-900/10 bg-gradient-to-br from-white via-blue-50/20 to-slate-50 p-4 shadow-sm sm:p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
                    <Building2 className="size-4" />
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 sm:text-sm">
                    School Identity &amp; Header
                  </h2>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                  <ShieldCheck className="size-3 text-emerald-600" /> Verified
                </span>
              </div>

              {/* Institutional Header Banner Preview */}
              <div className="mt-4 flex items-center gap-3.5 rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs sm:gap-4 sm:p-4">
                <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white p-1 shadow-2xs sm:size-16">
                  <img
                    src={FIXED_SCHOOL_LOGO}
                    alt="The Country School Logo"
                    className="size-full object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-black text-slate-900 sm:text-base leading-snug">
                      {FIXED_SCHOOL_NAME}
                    </h3>
                    <Lock className="size-3 text-slate-400 shrink-0" />
                  </div>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500 leading-tight">
                    {FIXED_SCHOOL_TAGLINE}
                  </p>
                </div>
              </div>

              {/* Session and Term Setup */}
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Default Academic Session
                    </Label>
                    <span className="text-[10px] font-bold text-slate-400">Printed on Card</span>
                  </div>
                  <Input
                    value={settings.defaultSession}
                    onChange={(e) => updateSettings({ defaultSession: e.target.value })}
                    placeholder="2026–2027"
                    className="h-10 rounded-xl border-slate-200 bg-slate-50/60 font-bold text-slate-900 focus-visible:bg-white focus-visible:ring-blue-500/30"
                  />
                  {/* Preset Session Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Presets:
                    </span>
                    {PRESET_SESSIONS.map((session) => (
                      <button
                        key={session}
                        type="button"
                        onClick={() => {
                          updateSettings({ defaultSession: session });
                          toast.success(`Session set to ${session}`);
                        }}
                        className={cn(
                          "press-card rounded-lg px-2 py-0.5 text-[11px] font-bold transition-all",
                          settings.defaultSession === session
                            ? "bg-blue-900 text-white shadow-2xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                        )}
                      >
                        {session}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">
                      Default Examination / Term
                    </Label>
                    <span className="text-[10px] font-bold text-slate-400">Printed on Card</span>
                  </div>
                  <Input
                    value={settings.defaultTerm}
                    onChange={(e) => updateSettings({ defaultTerm: e.target.value })}
                    placeholder="1st Term Examination"
                    className="h-10 rounded-xl border-slate-200 bg-slate-50/60 font-bold text-slate-900 focus-visible:bg-white focus-visible:ring-blue-500/30"
                  />
                  {/* Preset Term Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Presets:
                    </span>
                    {PRESET_TERMS.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => {
                          updateSettings({ defaultTerm: term });
                          toast.success(`Term set to ${term}`);
                        }}
                        className={cn(
                          "press-card rounded-lg px-2 py-0.5 text-[11px] font-bold transition-all",
                          settings.defaultTerm === term
                            ? "bg-blue-900 text-white shadow-2xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                        )}
                      >
                        {term.replace(" Examination", "")}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Official Signatures Section */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-800">
                    <Sparkles className="size-3.5" />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 sm:text-sm">
                    Official Signatures &amp; Stamps
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline">
                  Optional transparent PNG signatures
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ImageUploadField
                  label="Teacher's Signature"
                  subtitle="Printed above Teacher's Signature line"
                  value={settings.teacherSignatureDataUrl}
                  onFile={(f) => upload(f, "teacherSignatureDataUrl")}
                  onClear={() => {
                    updateSettings({ teacherSignatureDataUrl: null });
                    toast.success("Teacher signature cleared");
                  }}
                />

                <ImageUploadField
                  label="Head's Signature"
                  subtitle="Printed above Head's Signature line"
                  value={settings.headSignatureDataUrl}
                  onFile={(f) => upload(f, "headSignatureDataUrl")}
                  onClear={() => {
                    updateSettings({ headSignatureDataUrl: null });
                    toast.success("Head signature cleared");
                  }}
                />
              </div>

            </section>
          </div>
        )}

        {/* ── Tab 2: Grading Scale ── */}
        {activeTab === "grading" && (
          <section className="animate-fade-in overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                  <GraduationCap className="size-4.5" />
                </div>
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 sm:text-sm">
                    Grading Scale Thresholds
                  </h2>
                  <p className="text-[11px] font-semibold text-slate-400">
                    {settings.grades.length} Active Grade Levels
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleResetGrading}
                className="press-card gap-1.5 rounded-xl border-slate-300 text-xs font-bold text-slate-600 shadow-2xs hover:bg-slate-100"
              >
                <RotateCcw className="size-3" /> Reset Standard Scale
              </Button>
            </div>

            {/* Visual Grade Spectrum */}
            <div className="mt-3.5 rounded-xl bg-slate-50/80 p-2.5 border border-slate-100">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1.5">
                <span>0% Fail</span>
                <span className="text-slate-400">Grade Spectrum</span>
                <span>100% Top</span>
              </div>
              <div className="flex h-3 w-full overflow-hidden rounded-full border border-slate-200/80 bg-slate-200">
                {settings.grades.map((grade) => {
                  const width = Math.max(0, grade.max - grade.min);
                  return (
                    <div
                      key={grade.id}
                      style={{ width: `${width}%` }}
                      title={`${grade.name}: ${grade.min}% - ${grade.max}%`}
                      className={cn(
                        "h-full border-r border-white/50 transition-all",
                        grade.name.startsWith("A")
                          ? "bg-emerald-500"
                          : grade.name.startsWith("B")
                            ? "bg-sky-500"
                            : grade.name.startsWith("C")
                              ? "bg-blue-500"
                              : grade.name.startsWith("D")
                                ? "bg-amber-500"
                                : "bg-rose-500",
                      )}
                    />
                  );
                })}
              </div>
            </div>

            {/* Grade Rules List */}
            <div className="mt-4 space-y-2">
              <div className="hidden grid-cols-[3.5rem_1fr_6rem_6rem_2.5rem] items-center gap-2.5 rounded-xl bg-slate-100/90 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:grid">
                <span className="text-center">Badge</span>
                <span>Grade Title</span>
                <span className="text-center">Min %</span>
                <span className="text-center">Max %</span>
                <span className="text-right"></span>
              </div>

              {settings.grades.map((grade, index) => (
                <div
                  key={grade.id}
                  className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-2xs transition-all sm:grid sm:grid-cols-[3.5rem_1fr_6rem_6rem_2.5rem] sm:items-center sm:gap-2.5 sm:p-2 hover:border-slate-300"
                >
                  {/* Mobile Row 1: Badge + Grade Name + Trash */}
                  <div className="flex items-center gap-2 sm:contents">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg border font-black text-xs shadow-2xs ring-1",
                        getGradeBadgeStyle(grade.name),
                      )}
                    >
                      {grade.name || "?"}
                    </span>

                    <div className="flex-1 sm:min-w-0">
                      <Input
                        className="h-9 rounded-lg border-slate-200 bg-slate-50/50 font-bold text-slate-900 focus-visible:bg-white focus-visible:ring-blue-500/30"
                        value={grade.name}
                        placeholder="Grade (e.g. A+)"
                        onChange={(e) => {
                          const next = [...settings.grades];
                          next[index] = { ...grade, name: e.target.value };
                          setGrades(next);
                        }}
                      />
                    </div>

                    <div className="flex sm:hidden justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Remove grade"
                        onClick={() => setGrades(settings.grades.filter((g) => g.id !== grade.id))}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Range Inputs */}
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-0 sm:contents">
                    <div>
                      <span className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400 sm:hidden">
                        Min %
                      </span>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className="h-9 rounded-lg border-slate-200 bg-slate-50/50 text-center font-bold text-slate-800 focus-visible:bg-white focus-visible:ring-blue-500/30"
                        value={grade.min}
                        onChange={(e) => {
                          const next = [...settings.grades];
                          next[index] = { ...grade, min: Number(e.target.value) };
                          setGrades(next);
                        }}
                      />
                    </div>

                    <div>
                      <span className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400 sm:hidden">
                        Max %
                      </span>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className="h-9 rounded-lg border-slate-200 bg-slate-50/50 text-center font-bold text-slate-800 focus-visible:bg-white focus-visible:ring-blue-500/30"
                        value={grade.max}
                        onChange={(e) => {
                          const next = [...settings.grades];
                          next[index] = { ...grade, max: Number(e.target.value) };
                          setGrades(next);
                        }}
                      />
                    </div>
                  </div>

                  {/* Desktop Action */}
                  <div className="hidden sm:flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Remove grade"
                      onClick={() => setGrades(settings.grades.filter((g) => g.id !== grade.id))}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setGrades([...settings.grades, { id: uid(), name: "", min: 0, max: 0 }])
                }
                className="press-card gap-1.5 rounded-xl border-emerald-200 bg-emerald-50/80 text-xs font-bold text-emerald-900 shadow-2xs hover:bg-emerald-100"
              >
                <Plus className="size-3.5" /> Add Grade Level
              </Button>
            </div>
          </section>
        )}

        {/* ── Tab 3: Default Subjects & Total Marks ── */}
        {activeTab === "subjects" && (
          <section className="animate-fade-in overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-xl bg-violet-100 text-violet-800">
                  <PenTool className="size-4.5" />
                </div>
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 sm:text-sm">
                    Default Class Subjects
                  </h2>
                  <p className="text-[11px] font-semibold text-slate-400">
                    Preloaded whenever a new student is added
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleResetSubjects}
                className="press-card gap-1.5 rounded-xl border-slate-300 text-xs font-bold text-slate-600 shadow-2xs hover:bg-slate-100"
              >
                <RotateCcw className="size-3" /> Reset Standard Marks
              </Button>
            </div>

            {/* Subject List */}
            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-[2.5rem_1fr_6rem_2.25rem] sm:grid-cols-[3rem_1fr_7.5rem_3rem] items-center gap-2 rounded-xl bg-slate-100/90 px-2.5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:px-3.5">
                <span className="text-center">#</span>
                <span>Subject Name</span>
                <span className="text-center">Total Marks</span>
                <span className="text-right"></span>
              </div>

              {settings.defaultSubjects.map((subject, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[2.5rem_1fr_6rem_2.25rem] sm:grid-cols-[3rem_1fr_7.5rem_3rem] items-center gap-2 rounded-xl border border-slate-200/80 bg-white p-2 shadow-2xs transition-all hover:border-slate-300 sm:px-3 sm:py-2"
                >
                  {/* Index Number */}
                  <span className="flex size-7 sm:size-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-500 mx-auto">
                    {index + 1}
                  </span>

                  {/* Subject Name Input */}
                  <Input
                    className="h-9 rounded-lg border-slate-200 bg-slate-50/50 text-xs sm:text-sm font-bold text-slate-900 focus-visible:bg-white focus-visible:ring-blue-500/30"
                    value={subject.name}
                    placeholder="Subject name"
                    autoCapitalize="words"
                    onChange={(e) => {
                      const next = [...settings.defaultSubjects];
                      next[index] = { ...subject, name: capitalizeFirstLetter(e.target.value) };
                      updateSettings({ defaultSubjects: next });
                    }}
                  />

                  {/* Total Marks with mini steppers */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Decrease marks"
                      onClick={() => {
                        const cur = Number(subject.totalMarks) || 0;
                        if (cur > 10) {
                          const next = [...settings.defaultSubjects];
                          next[index] = { ...subject, totalMarks: cur - 5 };
                          updateSettings({ defaultSubjects: next });
                        }
                      }}
                      className="press-card flex size-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    >
                      <Minus className="size-3" />
                    </button>
                    <Input
                      type="number"
                      min={1}
                      className="h-9 min-w-0 flex-1 rounded-lg border-slate-200 bg-slate-50/50 px-1 text-center font-black text-xs sm:text-sm text-slate-900 focus-visible:bg-white focus-visible:ring-blue-500/30"
                      value={subject.totalMarks}
                      onChange={(e) => {
                        const next = [...settings.defaultSubjects];
                        next[index] = { ...subject, totalMarks: Number(e.target.value) };
                        updateSettings({ defaultSubjects: next });
                      }}
                    />
                    <button
                      type="button"
                      aria-label="Increase marks"
                      onClick={() => {
                        const cur = Number(subject.totalMarks) || 0;
                        const next = [...settings.defaultSubjects];
                        next[index] = { ...subject, totalMarks: cur + 5 };
                        updateSettings({ defaultSubjects: next });
                      }}
                      className="press-card flex size-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>

                  {/* Delete Subject Button */}
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Remove default subject"
                      onClick={() =>
                        updateSettings({
                          defaultSubjects: settings.defaultSubjects.filter((_, i) => i !== index),
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Actions & Grand Total Pill */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  updateSettings({
                    defaultSubjects: [...settings.defaultSubjects, { name: "", totalMarks: 50 }],
                  })
                }
                className="press-card gap-1.5 rounded-xl border-violet-200 bg-violet-50/80 text-xs font-bold text-violet-900 shadow-2xs hover:bg-violet-100"
              >
                <Plus className="size-3.5" /> Add Default Subject
              </Button>

              <div className="inline-flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200/80 px-3.5 py-1.5 text-xs font-bold text-blue-950 shadow-2xs">
                <span>Default Grand Total:</span>
                <span className="font-black text-blue-900 text-sm">{defaultTotalMarks} Marks</span>
              </div>
            </div>
          </section>
        )}

        {/* ── Tab 4: Printer Margins ── */}
        {activeTab === "margins" && (
          <section className="animate-fade-in overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <Printer className="size-4.5" />
                </div>
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 sm:text-sm">
                    Printer Margins &amp; Page Fit
                  </h2>
                  <p className="text-[11px] font-semibold text-slate-400">
                    Safe boundary to prevent clipped borders on physical printers
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {/* Interactive Visual Paper Diagram */}
              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/90 bg-slate-50/70 p-5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                  Visual Margin Preview
                </span>
                {/* Simulated A4 Paper */}
                <div className="relative aspect-[1/1.414] w-40 sm:w-48 rounded-lg bg-white shadow-md border border-slate-300 p-2 flex flex-col justify-between">
                  {/* Dynamic Margin Indicator Ring */}
                  <div
                    className="size-full rounded border-2 border-dashed border-blue-500 bg-blue-50/20 p-2 flex flex-col justify-between text-center transition-all duration-300"
                    style={{
                      margin: `${Math.max(4, (settings.printerMarginMm ?? 0) * 0.8)}px`,
                    }}
                  >
                    <div className="text-[9px] font-black text-blue-900 uppercase">
                      The Country School
                    </div>
                    <div className="rounded bg-blue-100/60 py-1 text-[8px] font-extrabold text-blue-800">
                      Card Body Area
                    </div>
                    <div className="text-[8px] font-bold text-slate-400">
                      Margin: {settings.printerMarginMm}mm
                    </div>
                  </div>
                </div>
              </div>

              {/* Margin Settings & Preset Options */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-800">
                    Edge Margin Preset (mm)
                  </Label>
                  <Select
                    value={String(normalizePrinterMarginMm(settings.printerMarginMm))}
                    onValueChange={(value) => {
                      const next = normalizePrinterMarginMm(Number(value));
                      updateSettings({ printerMarginMm: next });
                      toast.success(`Card margin set to ${next}mm`);
                    }}
                  >
                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50/50 text-sm font-bold text-slate-900 focus-visible:bg-white focus-visible:ring-blue-500/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {PRINTER_MARGIN_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Quick Preset Buttons */}
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Quick Presets:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { mm: 6, label: "Tight", desc: "6mm" },
                      { mm: 11, label: "Standard", desc: "11mm (Rec.)" },
                      { mm: 15, label: "Wide", desc: "15mm" },
                    ].map((item) => (
                      <button
                        key={item.mm}
                        type="button"
                        onClick={() => {
                          updateSettings({ printerMarginMm: item.mm });
                          toast.success(`Card margin set to ${item.mm}mm`);
                        }}
                        className={cn(
                          "press-card flex flex-col items-center justify-center rounded-xl border p-2 text-center transition-all",
                          settings.printerMarginMm === item.mm
                            ? "border-blue-900 bg-blue-950 text-white shadow-xs"
                            : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700",
                        )}
                      >
                        <span className="text-xs font-extrabold">{item.label}</span>
                        <span
                          className={cn(
                            "text-[10px]",
                            settings.printerMarginMm === item.mm
                              ? "text-blue-200"
                              : "text-slate-400",
                          )}
                        >
                          {item.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 text-xs leading-relaxed text-amber-900">
                  ⚠️ <strong>Inkjet &amp; Laser Printers:</strong> 11mm is recommended to ensure the
                  decorative outer double-line borders don't get trimmed by printer unprintable edge
                  limits.
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ImageUploadField({
  label,
  subtitle,
  value,
  onFile,
  onClear,
}: {
  label: string;
  subtitle: string;
  value: string | null;
  onFile: (file: File | undefined) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-slate-50/50 p-3.5 shadow-2xs">
      <div>
        <div className="flex items-center justify-between">
          <Label className="block text-xs font-bold text-slate-900">{label}</Label>
          {value ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
              <Check className="size-3" /> Uploaded
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-slate-400">Empty</span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-slate-500 font-medium">{subtitle}</p>

        <div className="mt-2.5 flex h-24 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white p-2">
          {value ? (
            <img src={value} alt={label} className="h-full max-h-20 w-auto object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-slate-400">
              <ImageIcon className="size-6 opacity-30" />
              <span className="text-[10px] font-bold">No signature set</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <label className="flex-1">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <span className="press-card inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50">
            <UploadCloud className="size-3.5 text-slate-500" />
            {value ? "Replace" : "Upload PNG"}
          </span>
        </label>

        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="press-card h-9 rounded-xl px-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50"
          >
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
