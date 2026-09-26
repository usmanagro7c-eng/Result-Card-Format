import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  Check,
  GraduationCap,
  Image as ImageIcon,
  PenTool,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_GRADES, resolveGrade } from "@/utils/grading";
import { DEFAULT_SETTINGS, DEFAULT_SUBJECTS, uid, useResultStore } from "@/store/resultStore";
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

function SettingsPage() {
  const { ready, settings, updateSettings } = useResultStore();
  const [testPercentage, setTestPercentage] = useState<number>(84.85);

  if (!ready) {
    return (
      <div className="px-4 py-24 text-center text-sm text-muted-foreground">
        Loading settings...
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

  const testGrade = resolveGrade(testPercentage, settings.grades);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
              <Link to="/">
                <ArrowLeft className="size-3.5" /> Back to Students
              </Link>
            </Button>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900">
            School &amp; Grading Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure school identity, logo, signatures, grading thresholds, and default subjects.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRestoreAllDefaults}
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3.5" /> Restore All Defaults
        </Button>
      </div>

      <div className="mt-8 space-y-8">
        {/* School Information & Branding */}
        <section className="rounded-lg border border-border bg-card p-6 shadow-xs">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border">
            <div className="flex size-8 items-center justify-center rounded-md bg-neutral-100 text-neutral-800">
              <Building2 className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900">
                School Information &amp; Header
              </h2>
              <p className="text-xs text-muted-foreground">
                These details appear on the header of every generated Progress Report.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold text-neutral-700">School Name</Label>
              <Input
                value={settings.schoolName}
                onChange={(e) => updateSettings({ schoolName: e.target.value })}
                placeholder="e.g. The Country School"
                className="font-medium"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold text-neutral-700">
                School Tagline / Affiliation
              </Label>
              <Input
                value={settings.schoolTagline}
                onChange={(e) => updateSettings({ schoolTagline: e.target.value })}
                placeholder="e.g. A project of Bloomfield Hall | Since 1984"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-neutral-700">
                Default Academic Session
              </Label>
              <Input
                value={settings.defaultSession}
                onChange={(e) => updateSettings({ defaultSession: e.target.value })}
                placeholder="2026–2027"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-neutral-700">
                Default Examination / Term
              </Label>
              <Input
                value={settings.defaultTerm}
                onChange={(e) => updateSettings({ defaultTerm: e.target.value })}
                placeholder="1st Term Examination"
              />
            </div>
          </div>

          {/* Logo & Signature Uploads */}
          <div className="mt-6 border-t border-border pt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Logo &amp; Official Signatures
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <ImageUploadField
                label="School Logo"
                helpText="Replaces the default emblem"
                value={settings.logoDataUrl}
                onFile={(f) => upload(f, "logoDataUrl")}
                onClear={() => {
                  updateSettings({ logoDataUrl: null });
                  toast.success("Logo cleared; standard crest emblem will be used");
                }}
              />

              <ImageUploadField
                label="Teacher's Signature"
                helpText="Optional digital signature"
                value={settings.teacherSignatureDataUrl}
                onFile={(f) => upload(f, "teacherSignatureDataUrl")}
                onClear={() => {
                  updateSettings({ teacherSignatureDataUrl: null });
                  toast.success("Teacher signature cleared");
                }}
              />

              <ImageUploadField
                label="Head's Signature"
                helpText="Optional digital signature"
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

        {/* Configurable Grading System */}
        <section className="rounded-lg border border-border bg-card p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-md bg-neutral-100 text-neutral-800">
                <GraduationCap className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900">
                  Configurable Grading Scale
                </h2>
                <p className="text-xs text-muted-foreground">
                  Define percentage thresholds for each letter grade (e.g. A+, A, B, C, D, E, F).
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleResetGrading}
              className="text-xs gap-1.5"
            >
              <RotateCcw className="size-3" /> Reset Standard Scale
            </Button>
          </div>

          {/* Interactive Live Grade Simulator */}
          <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50/70 p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500" />
              <span className="text-xs font-semibold text-neutral-800">Live Grade Tester:</span>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  className="h-8 w-20 bg-white text-center text-xs font-bold"
                  value={testPercentage}
                  onChange={(e) => setTestPercentage(Number(e.target.value))}
                />
                <span className="text-xs font-bold text-neutral-700">%</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Determined Grade:</span>
              <span className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-3 py-1 text-xs font-black text-white">
                {testGrade}
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <div className="hidden grid-cols-[1fr_7rem_7rem_3rem] gap-3 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
              <span>Grade Name</span>
              <span className="text-center">Min %</span>
              <span className="text-center">Max %</span>
              <span className="text-right">Action</span>
            </div>

            {settings.grades.map((grade, index) => (
              <div
                key={grade.id}
                className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_7rem_7rem_3rem] items-center"
              >
                <Input
                  className="col-span-2 sm:col-span-1 font-bold text-neutral-900"
                  value={grade.name}
                  placeholder="Grade (e.g. A+)"
                  onChange={(e) => {
                    const next = [...settings.grades];
                    next[index] = { ...grade, name: e.target.value };
                    setGrades(next);
                  }}
                />

                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="text-center font-medium"
                  value={grade.min}
                  onChange={(e) => {
                    const next = [...settings.grades];
                    next[index] = { ...grade, min: Number(e.target.value) };
                    setGrades(next);
                  }}
                />

                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="text-center font-medium"
                  value={grade.max}
                  onChange={(e) => {
                    const next = [...settings.grades];
                    next[index] = { ...grade, max: Number(e.target.value) };
                    setGrades(next);
                  }}
                />

                <div className="col-span-2 flex justify-end sm:col-span-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
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
              variant="secondary"
              size="sm"
              onClick={() =>
                setGrades([...settings.grades, { id: uid(), name: "", min: 0, max: 0 }])
              }
              className="gap-1.5 text-xs"
            >
              <Plus className="size-3.5" /> Add Grade Level
            </Button>
          </div>
        </section>

        {/* Default Subjects for New Students */}
        <section className="rounded-lg border border-border bg-card p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-md bg-neutral-100 text-neutral-800">
                <PenTool className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900">
                  Default Subjects &amp; Total Marks
                </h2>
                <p className="text-xs text-muted-foreground">
                  Pre-populated when creating any new student. Reference total: 495 marks.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleResetSubjects}
              className="text-xs gap-1.5"
            >
              <RotateCcw className="size-3" /> Reset Marks
            </Button>
          </div>

          <div className="mt-5 space-y-2">
            <div className="hidden grid-cols-[1fr_8rem_3rem] gap-3 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
              <span>Subject Name</span>
              <span className="text-center">Total Marks</span>
              <span className="text-right">Action</span>
            </div>

            {settings.defaultSubjects.map((subject, index) => (
              <div key={index} className="grid grid-cols-[1fr_8rem_3rem] gap-2 items-center">
                <Input
                  className="font-medium text-neutral-900"
                  value={subject.name}
                  placeholder="Subject name"
                  onChange={(e) => {
                    const next = [...settings.defaultSubjects];
                    next[index] = { ...subject, name: e.target.value };
                    updateSettings({ defaultSubjects: next });
                  }}
                />

                <Input
                  type="number"
                  min={1}
                  className="text-center font-bold text-neutral-900"
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
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                updateSettings({
                  defaultSubjects: [...settings.defaultSubjects, { name: "", totalMarks: 50 }],
                })
              }
              className="gap-1.5 text-xs"
            >
              <Plus className="size-3.5" /> Add Default Subject
            </Button>

            <div className="text-xs font-bold text-neutral-800">
              Default Grand Total:{" "}
              <span className="text-primary font-black">
                {settings.defaultSubjects.reduce((sum, s) => sum + (Number(s.totalMarks) || 0), 0)}{" "}
                Marks
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ImageUploadField({
  label,
  helpText,
  value,
  onFile,
  onClear,
}: {
  label: string;
  helpText?: string;
  value: string | null;
  onFile: (file: File | undefined) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-lg border border-border p-3.5 bg-neutral-50/50 flex flex-col justify-between">
      <div>
        <Label className="text-xs font-bold text-neutral-900 block">{label}</Label>
        {helpText ? <p className="text-[11px] text-muted-foreground mt-0.5">{helpText}</p> : null}

        <div className="mt-3 flex h-20 w-full items-center justify-center rounded-md border border-dashed border-neutral-300 bg-white p-1">
          {value ? (
            <img src={value} alt={label} className="h-full max-h-18 object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <ImageIcon className="size-5 opacity-40" />
              <span className="text-[10px]">No image uploaded</span>
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
          <span className="inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-md border border-neutral-300 bg-white px-2 text-xs font-semibold text-neutral-800 shadow-2xs hover:bg-neutral-50">
            {value ? "Change File" : "Upload File"}
          </span>
        </label>

        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
          >
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}
