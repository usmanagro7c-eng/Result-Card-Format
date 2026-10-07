import * as React from "react";
import { Loader2, FileDown, CheckCircle2, AlertCircle, HardDrive } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useBulkExportProgress } from "@/hooks/useBulkExportProgress";

interface BulkExportDialogProps {
  onCancel: () => void;
}

export function BulkExportDialog({ onCancel }: BulkExportDialogProps) {
  const progress = useBulkExportProgress();
  const { isOpen, phase, current, total, percent, label, studentName, isCancelling } =
    progress;

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isCancelling) {
          onCancel();
        }
      }}
    >
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          if (!isCancelling) onCancel();
        }}
        className="w-[calc(100%-2rem)] max-w-sm rounded-3xl p-6 sm:rounded-3xl border-slate-100 shadow-2xl"
      >
        <DialogHeader className="items-center text-center">
          {/* Animated Status Icon */}
          <div className="mb-2">
            {percent >= 100 ? (
              <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60 animate-in zoom-in duration-300">
                <CheckCircle2 className="size-7 stroke-[2.5]" />
              </div>
            ) : isCancelling ? (
              <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-8 ring-amber-50/60">
                <AlertCircle className="size-7" />
              </div>
            ) : phase === "saving" ? (
              <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-8 ring-indigo-50/60">
                <HardDrive className="size-7 animate-pulse text-indigo-600" />
              </div>
            ) : (
              <div className="relative flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-8 ring-blue-50/60">
                <FileDown className="size-7 text-blue-600 animate-bounce" />
              </div>
            )}
          </div>

          <DialogTitle className="text-lg font-black tracking-tight text-slate-900">
            {percent >= 100
              ? "Export Complete!"
              : isCancelling
                ? "Cancelling Export..."
                : phase === "saving"
                  ? "Writing to Storage..."
                  : phase === "finalising"
                    ? "Compiling PDF..."
                    : "Exporting Result Cards"}
          </DialogTitle>

          <DialogDescription className="text-xs font-semibold text-slate-500">
            Batch of {total} Students • Page {current} of {total}
          </DialogDescription>
        </DialogHeader>

        {/* Active Student Indicator */}
        <div className="min-h-[38px] w-full text-center px-2">
          {phase === "rendering" && studentName ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Now Processing
              </p>
              <p className="truncate text-sm font-bold text-slate-800" title={studentName}>
                {studentName}
              </p>
            </div>
          ) : phase === "finalising" ? (
            <p className="text-xs font-semibold text-blue-700">
              Assembling 300 DPI high-resolution pages...
            </p>
          ) : phase === "saving" ? (
            <p className="text-xs font-semibold text-indigo-700">
              Writing multi-page file to Downloads folder...
            </p>
          ) : percent >= 100 ? (
            <p className="text-xs font-bold text-emerald-700">All {total} cards compiled</p>
          ) : null}
        </div>

        {/* Determinate Progress Bar */}
        <div className="w-full space-y-1.5">
          <Progress value={percent} className="h-2.5 w-full bg-slate-100" />
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-500 truncate max-w-[220px]">
              {label || (phase === "saving" ? "Saving PDF..." : `Card ${current} of ${total}`)}
            </span>
            <span className="font-bold text-blue-600 shrink-0">{percent}%</span>
          </div>
        </div>

        {/* Helpful User Advice */}
        <div className="w-full rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-left">
          <div className="flex items-start gap-2">
            {percent < 100 && !isCancelling && (
              <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-blue-600" />
            )}
            <p className="text-[11px] leading-relaxed text-slate-500 font-medium">
              {percent >= 100
                ? "Your document has been compiled and saved to your device."
                : isCancelling
                  ? "Stopping export safely..."
                  : "Please keep this screen open while exporting. Cards are rendered at scale 2 (300 DPI) for crisp printing."}
            </p>
          </div>
        </div>

        {/* Cancel Button */}
        {percent < 100 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isCancelling || phase === "saving"}
            className="h-10 w-full rounded-xl border-slate-200 font-bold text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
          >
            {isCancelling ? "Cancelling..." : "Cancel Export"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
