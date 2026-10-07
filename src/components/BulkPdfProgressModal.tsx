import React from "react";
import { Loader2, FileDown, CheckCircle2, AlertCircle, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface BulkPdfProgressState {
  open: boolean;
  current: number;
  total: number;
  percent: number;
  studentName?: string;
  stage: "rendering" | "building" | "saving" | "done" | "cancelling";
}

interface BulkPdfProgressModalProps {
  progress: BulkPdfProgressState | null;
  onCancel: () => void;
}

export function BulkPdfProgressModal({ progress, onCancel }: BulkPdfProgressModalProps) {
  if (!progress || !progress.open) return null;

  const { current, total, percent, studentName, stage } = progress;
  const isDone = stage === "done";
  const isCancelling = stage === "cancelling";
  const isSaving = stage === "saving";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Generating Bulk PDF"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
        {/* Animated Status Icon */}
        <div className="relative mb-4">
          {isDone ? (
            <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60 animate-in zoom-in duration-300">
              <CheckCircle2 className="size-8 stroke-[2.5]" />
            </div>
          ) : isCancelling ? (
            <div className="flex size-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-8 ring-amber-50/60">
              <AlertCircle className="size-8" />
            </div>
          ) : isSaving ? (
            <div className="flex size-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-8 ring-indigo-50/60">
              <HardDrive className="size-8 animate-pulse text-indigo-600" />
            </div>
          ) : (
            <div className="relative flex size-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-8 ring-blue-50/60">
              <FileDown className="size-7 text-blue-600 animate-bounce" />
            </div>
          )}
        </div>

        {/* Modal Heading */}
        <h3 className="text-lg font-black tracking-tight text-slate-900">
          {isDone
            ? "PDF Generated Successfully!"
            : isCancelling
              ? "Cancelling Generation..."
              : isSaving
                ? "Writing PDF to Device..."
                : "Generating Result Cards"}
        </h3>

        {/* Batch Counter Pill */}
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
          <span>Batch of {total} Students</span>
          <span className="text-slate-300">•</span>
          <span className="text-blue-600">Card {current} of {total}</span>
        </div>

        {/* Active Student Indicator */}
        <div className="mt-3 min-h-[38px] w-full px-2">
          {stage === "rendering" && studentName ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Processing Student
              </p>
              <p className="truncate text-sm font-bold text-slate-800" title={studentName}>
                {studentName}
              </p>
            </div>
          ) : isSaving ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">
                Finalizing Document
              </p>
              <p className="text-sm font-bold text-indigo-900">
                Compressing & saving to Downloads folder...
              </p>
            </div>
          ) : isDone ? (
            <p className="text-sm font-bold text-emerald-700">All {total} cards compiled</p>
          ) : isCancelling ? (
            <p className="text-sm font-medium text-amber-700">Stopping safely...</p>
          ) : null}
        </div>

        {/* Visual Progress Bar */}
        <div className="mt-4 w-full">
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 p-0.5 ring-1 ring-inset ring-slate-200/70">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-out ${
                isDone
                  ? "bg-emerald-500"
                  : isCancelling
                    ? "bg-amber-500"
                    : isSaving
                      ? "bg-indigo-600"
                      : "bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400">
              {isDone
                ? "Complete"
                : isSaving
                  ? "Saving PDF"
                  : isCancelling
                    ? "Stopping"
                    : `Page ${current} of ${total}`}
            </span>
            <span
              className={`font-bold ${
                isDone
                  ? "text-emerald-600"
                  : isSaving
                    ? "text-indigo-600"
                    : "text-blue-600"
              }`}
            >
              {percent}%
            </span>
          </div>
        </div>

        {/* Helpful User Advice */}
        <div className="mt-4 w-full rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-left">
          <div className="flex items-start gap-2">
            {!isDone && !isCancelling && (
              <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-blue-600" />
            )}
            <p className="text-[11px] leading-relaxed text-slate-500 font-medium">
              {isDone
                ? "Your PDF document has been created and saved directly to your Downloads folder."
                : isSaving
                  ? "Writing the multi-page file to storage. Almost done!"
                  : "Please leave this screen open while processing. All result cards are rendered in full A4 quality."}
            </p>
          </div>
        </div>

        {/* Cancel Button */}
        {!isDone && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isCancelling || isSaving}
            className="mt-4 h-10 w-full rounded-xl border-slate-200 font-bold text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
          >
            {isCancelling ? "Cancelling..." : "Cancel Export"}
          </Button>
        )}
      </div>
    </div>
  );
}
