import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  Check,
  GraduationCap,
  Image as ImageIcon,
  Lock,
  PenTool,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
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
      { title: "Settings & Grading System — School Result Card Generator" },
      {
        name: "description",
        content:
          "Configure school branding, logo, signature uploads, grading thresholds, and default class subjects.",
      },
      { property: "og:title", content: "Settings & Grading System" },
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
    icon: Building2,
  },
  {
    id: "grading" as const,
    label: "Grading Scale",
    icon: GraduationCap,
  },
  {
    id: "subjects" as const,
    label: "Default Subjects",
    icon: PenTool,
  },
  {
    id: "margins" as const,
    label: "Printer Margins",
    icon: Printer,
  },
];

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
      toast.error("Could not read that image file. Please upload a PNG or JPEG.");
    }
  };

  const handleResetGrading = () => {
    setGrades(DEFAULT_GRADES);
    toast.success("Grading scale reset to standard (A+, A, B, C, D, E, F)");
  };

  const handleResetSubjects = () => {
    updateSettings({ defaultSubjects: DEFAULT_SUBJECTS });
    toast.success("Default subjects reset to Class Standard (Total: 495 Marks)");
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
    <div className="mx-auto w-full max-w-4xl px-4 pt-6 pb-24 sm:px-6 sm:py-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              <Link to="/">
                <ArrowLeft className="size-4" /> Back to Students
              </Link>
            </Button>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            School &amp; Grading Settings
          </h1>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRestoreAllDefaults}
          className="gap-1.5 rounded-xl border-slate-300 text-xs font-semibold text-slate-600 shadow-2xs hover:bg-slate-100 hover:text-slate-900"
        >
          <RotateCcw className="size-3.5" /> Restore All Defaults
        </Button>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="mt-6">
        <div
          role="tablist"
          aria-label="Settings categories"
          className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200/90 bg-slate-100/90 p-1.5 shadow-inner sm:grid-cols-4 sm:gap-2"
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
                  "flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all sm:min-h-11 sm:text-sm active:scale-95",
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

      <div className="mt-8 space-y-7">
        {/* School Information & Branding */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="flex size-9 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
              <Building2 className="size-5" />
            </div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
              School Information &amp; Header
            </h2>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-700">School Name</Label>
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                  <Lock className="size-3 text-slate-400" />
                </span>
              </div>
              <Input
                value={FIXED_SCHOOL_NAME}
                readOnly
                disabled
                className="cursor-not-allowed rounded-xl border-slate-200 bg-slate-100/70 font-bold text-slate-700 select-none"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-700">
                  School Tagline / Affiliation
                </Label>
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                  <Lock className="size-3 text-slate-400" />
                </span>
              </div>
              <Input
                value={FIXED_SCHOOL_TAGLINE}
                readOnly
                disabled
                className="cursor-not-allowed rounded-xl border-slate-200 bg-slate-100/70 font-medium text-slate-700 select-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Default Academic Session</Label>
              <Input
                value={settings.defaultSession}
                onChange={(e) => updateSettings({ defaultSession: e.target.value })}
                placeholder="2026–2027"
                className="rounded-xl border-slate-200 bg-slate-50/50 focus-visible:bg-white focus-visible:ring-blue-500/30"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Default Examination / Term</Label>
              <Input
                value={settings.defaultTerm}
                onChange={(e) => updateSettings({ defaultTerm: e.target.value })}
                placeholder="1st Term Examination"
                className="rounded-xl border-slate-200 bg-slate-50/50 focus-visible:bg-white focus-visible:ring-blue-500/30"
              />
            </div>
          </div>

          {/* Logo & Signature Uploads */}
          <div className="mt-7 border-t border-slate-100 pt-6">
            <h3 className="mb-4 text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Logo &amp; Official Signatures
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Uneditable Fixed School Logo */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="block text-xs font-bold text-slate-900">School Logo</Label>
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      <Lock className="size-3 text-slate-400" />
                    </span>
                  </div>

                  <div className="mt-3 flex h-24 w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
                    <img
                      src={FIXED_SCHOOL_LOGO}
                      alt="TCS Logo"
                      className="h-full max-h-20 w-auto object-contain"
                    />
                  </div>
                </div>

                <div className="mt-3 flex h-9 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-100/80 px-3 text-xs font-semibold text-slate-500 select-none">
                  The Country School
                </div>
              </div>

              <ImageUploadField
                label="Teacher's Signature"
                value={settings.teacherSignatureDataUrl}
                onFile={(f) => upload(f, "teacherSignatureDataUrl")}
                onClear={() => {
                  updateSettings({ teacherSignatureDataUrl: null });
                  toast.success("Teacher signature cleared");
                }}
              />

              <ImageUploadField
                label="Head's Signature"
                value={settings.headSignatureDataUrl}
                onFile={(f) => upload(f, "headSignatureDataUrl")}
                onClear={() => {
                  updateSettings({ headSignatureDataUrl: null });
                  toast.success("Head signature cleared");
                }}
              />
            </div>
          </div>
        </section>

        {/* Printer Safety */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Printer className="size-5" />
              </div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
                Printer Margins
              </h2>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="space-y-1.5 max-w-sm">
              <Label className="text-xs font-bold text-slate-700">Edge Margin</Label>
              <Select
                value={String(normalizePrinterMarginMm(settings.printerMarginMm))}
                onValueChange={(value) => {
                  const next = normalizePrinterMarginMm(Number(value));
                  updateSettings({ printerMarginMm: next });
                  toast.success(`Card frame set ${next}mm from the paper edge`);
                }}
              >
                <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50/50 text-sm font-medium focus-visible:bg-white focus-visible:ring-blue-500/30">
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
          </div>
        </section>

        {/* Configurable Grading System */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                <GraduationCap className="size-5" />
              </div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
                Grading Scale
              </h2>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleResetGrading}
              className="gap-1.5 rounded-xl border-slate-300 text-xs font-semibold text-slate-600 shadow-2xs hover:bg-slate-100"
            >
              <RotateCcw className="size-3" /> Reset Standard Scale
            </Button>
          </div>

          {/* Grade Rules Table */}
          <div className="mt-5 space-y-2">
            <div className="hidden grid-cols-[1fr_7rem_7rem_3rem] items-center gap-3 rounded-xl bg-slate-100/80 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:grid">
              <span>Grade Name</span>
              <span className="text-center">Min %</span>
              <span className="text-center">Max %</span>
              <span className="text-right">Action</span>
            </div>

            {settings.grades.map((grade, index) => (
              <div
                key={grade.id}
                className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-2xs sm:grid-cols-[1fr_7rem_7rem_3rem] sm:items-center sm:gap-3 sm:border-slate-200/60 sm:p-2 sm:shadow-none"
              >
                <div className="col-span-2 sm:col-span-1">
                  <Input
                    className="h-9 rounded-lg border-slate-200 bg-slate-50/40 font-bold text-slate-900 focus-visible:bg-white focus-visible:ring-blue-500/30"
                    value={grade.name}
                    placeholder="Grade (e.g. A+)"
                    onChange={(e) => {
                      const next = [...settings.grades];
                      next[index] = { ...grade, name: e.target.value };
                      setGrades(next);
                    }}
                  />
                </div>

                <div>
                  <span className="mb-1 block text-[10px] font-bold uppercase text-slate-400 sm:hidden">
                    Min %
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="h-9 rounded-lg border-slate-200 bg-slate-50/40 text-center font-semibold text-slate-700 focus-visible:bg-white focus-visible:ring-blue-500/30"
                    value={grade.min}
                    onChange={(e) => {
                      const next = [...settings.grades];
                      next[index] = { ...grade, min: Number(e.target.value) };
                      setGrades(next);
                    }}
                  />
                </div>

                <div>
                  <span className="mb-1 block text-[10px] font-bold uppercase text-slate-400 sm:hidden">
                    Max %
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="h-9 rounded-lg border-slate-200 bg-slate-50/40 text-center font-semibold text-slate-700 focus-visible:bg-white focus-visible:ring-blue-500/30"
                    value={grade.max}
                    onChange={(e) => {
                      const next = [...settings.grades];
                      next[index] = { ...grade, max: Number(e.target.value) };
                      setGrades(next);
                    }}
                  />
                </div>

                <div className="col-span-2 flex justify-end sm:col-span-1">
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
              className="gap-1.5 rounded-xl border-emerald-200 bg-emerald-50/80 text-xs font-bold text-emerald-900 shadow-2xs hover:bg-emerald-100"
            >
              <Plus className="size-3.5" /> Add Grade Level
            </Button>
          </div>
        </section>

        {/* Default Subjects for New Students */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-violet-100 text-violet-800">
                <PenTool className="size-5" />
              </div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
                Default Subjects &amp; Total Marks
              </h2>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleResetSubjects}
              className="gap-1.5 rounded-xl border-slate-300 text-xs font-semibold text-slate-600 shadow-2xs hover:bg-slate-100"
            >
              <RotateCcw className="size-3" /> Reset Standard Marks
            </Button>
          </div>

          <div className="mt-5 space-y-2">
            <div className="grid grid-cols-[1fr_5.5rem_2.25rem] sm:grid-cols-[1fr_8rem_3rem] items-center gap-2 rounded-xl bg-slate-100/80 px-2.5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:px-3.5">
              <span>Subject Name</span>
              <span className="text-center">Total Marks</span>
              <span className="text-right"></span>
            </div>

            {settings.defaultSubjects.map((subject, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_5.5rem_2.25rem] sm:grid-cols-[1fr_8rem_3rem] items-center gap-2 rounded-xl border border-slate-200/70 bg-white p-2 shadow-2xs transition-all hover:border-slate-300 sm:px-3 sm:py-2"
              >
                <Input
                  className="h-9 rounded-lg border-slate-200 bg-slate-50/40 text-sm font-semibold text-slate-900 focus-visible:bg-white focus-visible:ring-blue-500/30"
                  value={subject.name}
                  placeholder="Subject name"
                  autoCapitalize="words"
                  onChange={(e) => {
                    const next = [...settings.defaultSubjects];
                    next[index] = { ...subject, name: capitalizeFirstLetter(e.target.value) };
                    updateSettings({ defaultSubjects: next });
                  }}
                />

                <Input
                  type="number"
                  min={1}
                  className="h-9 rounded-lg border-slate-200 bg-slate-50/40 text-center font-black text-slate-900 focus-visible:bg-white focus-visible:ring-blue-500/30"
                  value={subject.totalMarks}
                  onChange={(e) => {
                    const next = [...settings.defaultSubjects];
                    next[index] = { ...subject, totalMarks: Number(e.target.value) };
                    updateSettings({ defaultSubjects: next });
                  }}
                />

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
              className="gap-1.5 rounded-xl border-violet-200 bg-violet-50/80 text-xs font-bold text-violet-900 shadow-2xs hover:bg-violet-100"
            >
              <Plus className="size-3.5" /> Add Default Subject
            </Button>

            <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3.5 py-1.5 text-xs font-bold text-slate-700">
              <span>Default Grand Total:</span>
              <span className="font-black text-blue-900">{defaultTotalMarks} Marks</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ImageUploadField({
  label,
  value,
  onFile,
  onClear,
}: {
  label: string;
  value: string | null;
  onFile: (file: File | undefined) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 shadow-2xs">
      <div>
        <Label className="block text-xs font-bold text-slate-900">{label}</Label>

        <div className="mt-3 flex h-24 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white p-2">
          {value ? (
            <img src={value} alt={label} className="h-full max-h-20 w-auto object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-slate-400">
              <ImageIcon className="size-6 opacity-40" />
              <span className="text-[11px] font-medium">No image uploaded</span>
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
          <span className="inline-flex h-9 w-full cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-98 transition-transform">
            {value ? "Change File" : "Upload File"}
          </span>
        </label>

        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-9 rounded-xl px-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
          >
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}
