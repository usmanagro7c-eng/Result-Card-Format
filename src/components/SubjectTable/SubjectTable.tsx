import { useCallback, useEffect, useRef } from "react";
import { ArrowDown, ArrowUp, Minus, Plus, RotateCcw, Sun, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { Subject } from "@/types/result";
import { subjectErrors } from "@/utils/calculations";
import { SUMMER_WORK_LABEL, SUMMER_WORK_TOTAL_MARKS, findSummerWork } from "@/utils/summerWork";
import { DEFAULT_SUBJECTS, uid } from "@/store/resultStore";
import { cn, capitalizeFirstLetter } from "@/lib/utils";

interface Props {
  subjects: Subject[];
  onChange: (subjects: Subject[]) => void;
  includeSummerWork?: boolean;
  onIncludeSummerWorkChange: (value: boolean) => void;
}

export function SubjectTable({
  subjects,
  onChange,
  includeSummerWork = false,
  onIncludeSummerWorkChange,
}: Props) {
  const errors = subjectErrors(subjects);
  const summerWork = findSummerWork(subjects);

  const patch = (id: string, values: Partial<Subject>) =>
    onChange(subjects.map((s) => (s.id === id ? { ...s, ...values } : s)));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= subjects.length) return;
    const next = [...subjects];
    const moved = next[index];
    const displaced = next[target];
    if (moved === undefined || displaced === undefined) return;
    [next[index], next[target]] = [displaced, moved];
    onChange(next);
  };

  const resetToStandard = () => {
    onChange(
      DEFAULT_SUBJECTS.map((sub) => ({
        id: uid(),
        name: sub.name,
        totalMarks: sub.totalMarks,
        obtainedMarks: 0,
      })),
    );
  };

  const stepObtained = (subject: Subject, delta: number) => {
    const next = Math.min(subject.totalMarks, Math.max(0, subject.obtainedMarks + delta));
    if (next === subject.obtainedMarks) return;
    patch(subject.id, { obtainedMarks: next });
  };

  const addSummerWork = () => {
    if (summerWork) return;
    onChange([
      ...subjects,
      {
        id: uid(),
        name: SUMMER_WORK_LABEL,
        totalMarks: SUMMER_WORK_TOTAL_MARKS,
        obtainedMarks: 0,
      },
    ]);
  };

  return (
    <div className="space-y-3.5">
      <div className="hidden grid-cols-[1fr_6.5rem_6.5rem_6rem] items-center gap-2.5 rounded-xl bg-slate-100/80 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:grid">
        <span>Subject</span>
        <span className="text-center">Total Marks</span>
        <span className="text-center">Obtained</span>
        <span className="text-right">Actions</span>
      </div>

      {subjects.length === 0 ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-500">
          <p className="font-medium">No subjects added yet.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetToStandard}
            className="rounded-xl border-slate-300 font-semibold"
          >
            <RotateCcw className="size-3.5" /> Load Class Subjects
          </Button>
        </div>
      ) : null}

      <div className="space-y-2.5">
        {subjects.map((subject, index) => {
          const hasError = !!errors[subject.id];
          const isOverLimit = subject.obtainedMarks > subject.totalMarks;

          return (
            <div
              key={subject.id}
              className={cn(
                "rounded-2xl transition-all",
                hasError ? "bg-rose-50/40 p-2 sm:p-0" : "",
              )}
            >
              {/* MOBILE: balanced modern card layout */}
              <div className="space-y-2 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xs sm:hidden">
                {/* Row 1: Subject Name + Action Icons */}
                <div className="flex items-center gap-1.5">
                  <Input
                    className={cn(
                      "h-9 min-w-0 flex-1 rounded-xl bg-slate-50/60 text-sm font-semibold placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-blue-500/30",
                      !subject.name.trim() ? "border-rose-400 focus-visible:ring-rose-300" : "border-slate-200",
                    )}
                    value={subject.name}
                    placeholder="Subject name (e.g. English)"
                    aria-label="Subject name"
                    autoCapitalize="words"
                    onChange={(e) => patch(subject.id, { name: capitalizeFirstLetter(e.target.value) })}
                  />

                  <div className="flex items-center shrink-0 gap-0.5">
                    <button
                      type="button"
                      disabled={index === 0}
                      title="Move up"
                      aria-label="Move up"
                      onClick={() => move(index, -1)}
                      className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 active:bg-slate-200 disabled:opacity-20"
                    >
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === subjects.length - 1}
                      title="Move down"
                      aria-label="Move down"
                      onClick={() => move(index, 1)}
                      className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 active:bg-slate-200 disabled:opacity-20"
                    >
                      <ArrowDown className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Remove subject"
                      aria-label="Remove subject"
                      onClick={() => onChange(subjects.filter((s) => s.id !== subject.id))}
                      className="flex size-8 items-center justify-center rounded-lg text-rose-400 transition-colors hover:bg-rose-50 hover:text-rose-600 active:bg-rose-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Row 2: Total Marks and Obtained Marks in two balanced columns */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-slate-50/70 px-2.5 py-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">Total:</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      enterKeyHint="next"
                      min={1}
                      className={cn(
                        "h-7 w-16 border-0 bg-transparent p-0 text-right text-sm font-black shadow-none focus-visible:ring-0",
                        subject.totalMarks <= 0 ? "text-rose-600" : "text-slate-800",
                      )}
                      value={subject.totalMarks === 0 ? "" : subject.totalMarks}
                      placeholder="—"
                      aria-label={`Total marks for ${subject.name || "subject"}`}
                      onChange={(e) =>
                        patch(subject.id, {
                          totalMarks: e.target.value === "" ? 0 : Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between gap-1 rounded-xl border border-slate-200/90 bg-slate-50/70 px-1.5 py-1">
                    <HoldButton
                      label={`Decrease ${subject.name || "subject"} marks`}
                      onStep={() => stepObtained(subject, -1)}
                      disabled={subject.obtainedMarks <= 0}
                      className="press-card size-8 shrink-0 rounded-lg border border-slate-200 bg-white text-slate-600 shadow-2xs active:bg-slate-100"
                    >
                      <Minus className="size-3.5" />
                    </HoldButton>

                    <Input
                      type="number"
                      inputMode="numeric"
                      enterKeyHint="next"
                      data-obtained-index={index}
                      min={0}
                      className={cn(
                        "h-7 min-w-0 flex-1 border-0 bg-transparent p-0 text-center text-sm font-black shadow-none focus-visible:ring-0",
                        isOverLimit || subject.obtainedMarks < 0 ? "text-rose-600" : "text-slate-900",
                      )}
                      value={subject.obtainedMarks === 0 ? "" : subject.obtainedMarks}
                      placeholder="0"
                      aria-label={`Obtained marks for ${subject.name || "subject"}`}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const nextInput = document.querySelector<HTMLInputElement>(
                            `[data-obtained-index="${index + 1}"]`,
                          );
                          if (nextInput) {
                            nextInput.focus();
                            nextInput.select();
                          }
                        }
                      }}
                      onChange={(e) =>
                        patch(subject.id, {
                          obtainedMarks: e.target.value === "" ? 0 : Number(e.target.value),
                        })
                      }
                    />

                    <HoldButton
                      label={`Increase ${subject.name || "subject"} marks`}
                      onStep={() => stepObtained(subject, 1)}
                      disabled={subject.obtainedMarks >= subject.totalMarks}
                      className="press-card size-8 shrink-0 rounded-lg border border-slate-200 bg-white text-slate-600 shadow-2xs active:bg-slate-100"
                    >
                      <Plus className="size-3.5" />
                    </HoldButton>
                  </div>
                </div>

                {/* Mini score progress bar on mobile */}
                {subject.totalMarks > 0 && (
                  <div className="pt-0.5">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-200",
                          isOverLimit
                            ? "bg-rose-500"
                            : "bg-gradient-to-r from-blue-700 to-indigo-800",
                        )}
                        style={{
                          width: `${Math.min(100, Math.max(0, Math.round((subject.obtainedMarks / subject.totalMarks) * 100)))}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* DESKTOP: single row with modern card styling */}
              <div className="hidden grid-cols-[1fr_6.5rem_6.5rem_6rem] items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white px-3 py-2 shadow-2xs transition-all hover:border-slate-300 sm:grid">
                <Input
                  className={cn(
                    "h-9 rounded-lg border-slate-200 bg-slate-50/40 text-sm font-medium focus-visible:bg-white focus-visible:ring-blue-500/30",
                    !subject.name.trim() ? "border-rose-400 focus-visible:ring-rose-300" : "",
                  )}
                  value={subject.name}
                  placeholder="Subject name (e.g. English)"
                  autoCapitalize="words"
                  onChange={(e) => patch(subject.id, { name: capitalizeFirstLetter(e.target.value) })}
                />

                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className={cn(
                    "h-9 rounded-lg border-slate-200 bg-slate-50/40 text-center font-bold focus-visible:bg-white focus-visible:ring-blue-500/30",
                    subject.totalMarks <= 0
                      ? "border-rose-400 focus-visible:ring-rose-300"
                      : "",
                  )}
                  value={subject.totalMarks === 0 ? "" : subject.totalMarks}
                  placeholder="Total"
                  onChange={(e) =>
                    patch(subject.id, {
                      totalMarks: e.target.value === "" ? 0 : Number(e.target.value),
                    })
                  }
                />

                <Input
                  type="number"
                  inputMode="numeric"
                  data-obtained-index={index}
                  min={0}
                  className={cn(
                    "h-9 rounded-lg border-slate-200 bg-slate-50/40 text-center font-black focus-visible:bg-white focus-visible:ring-blue-500/30",
                    isOverLimit || subject.obtainedMarks < 0
                      ? "border-rose-400 text-rose-600 focus-visible:ring-rose-300"
                      : "text-slate-900",
                  )}
                  value={subject.obtainedMarks === 0 ? "" : subject.obtainedMarks}
                  placeholder="Obtained"
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const nextInput = document.querySelector<HTMLInputElement>(
                        `[data-obtained-index="${index + 1}"]`,
                      );
                      if (nextInput) {
                        nextInput.focus();
                        nextInput.select();
                      }
                    }
                  }}
                  onChange={(e) =>
                    patch(subject.id, {
                      obtainedMarks: e.target.value === "" ? 0 : Number(e.target.value),
                    })
                  }
                />

                <div className="flex justify-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    disabled={index === 0}
                    title="Move up"
                    aria-label="Move up"
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    disabled={index === subjects.length - 1}
                    title="Move down"
                    aria-label="Move down"
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    title="Remove subject"
                    aria-label="Remove subject"
                    onClick={() => onChange(subjects.filter((s) => s.id !== subject.id))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Summer work toggle row */}
              {subject.id === summerWork?.id ? (
                <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-2.5">
                  <span className="text-xs font-semibold text-amber-900">
                    Add these marks to Grand Total
                  </span>
                  <Switch
                    checked={includeSummerWork}
                    onCheckedChange={onIncludeSummerWorkChange}
                    aria-label="Add Summer Work marks to Grand Total"
                  />
                </div>
              ) : null}

              {errors[subject.id] ? (
                <p className="mt-1 px-1 text-xs font-semibold text-rose-500">
                  {errors[subject.id]}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 gap-1.5 rounded-xl border-blue-200 bg-blue-50/80 font-bold text-blue-900 shadow-2xs hover:bg-blue-100 sm:min-h-8"
            onClick={() =>
              onChange([...subjects, { id: uid(), name: "", totalMarks: 50, obtainedMarks: 0 }])
            }
          >
            <Plus className="size-4" /> Add Subject
          </Button>

          {!summerWork ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10 gap-1.5 rounded-xl border-amber-200 bg-amber-50/80 font-bold text-amber-900 shadow-2xs hover:bg-amber-100 sm:min-h-8"
              onClick={addSummerWork}
            >
              <Sun className="size-4" /> Add Summer Work
            </Button>
          ) : null}
        </div>

        {subjects.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-10 text-xs font-medium text-slate-400 hover:text-slate-700 sm:min-h-8"
            onClick={resetToStandard}
          >
            <RotateCcw className="size-3.5" /> Reset to Class Standard
          </Button>
        ) : null}
      </div>
    </div>
  );
}

const HOLD_DELAY_MS = 400;
const HOLD_REPEAT_MS = 90;

/**
 * Tap fires one step; press-and-hold auto-repeats, so a teacher can run a
 * score from 0 up to 68 without lifting their thumb or using the keypad.
 *
 * The repeat timer calls through `stepRef` rather than the captured `onStep`.
 * `onStep` closes over the subject snapshot from the render that started the
 * hold, so calling it directly would recompute `snapshot + 1` forever and the
 * value would never advance past the first tick.
 */
function HoldButton({
  onStep,
  label,
  className,
  children,
  disabled,
}: {
  onStep: () => void;
  label: string;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef = useRef(onStep);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    stepRef.current = onStep;
    disabledRef.current = disabled;
  }, [onStep, disabled]);

  const stop = useCallback(() => {
    if (delayRef.current) {
      clearTimeout(delayRef.current);
      delayRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => stop, [stop]);

  // A button that becomes disabled mid-hold (score hit the total) must stop.
  useEffect(() => {
    if (disabled) stop();
  }, [disabled, stop]);

  const start = () => {
    if (disabledRef.current) return;
    stepRef.current();
    stop();
    delayRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        if (disabledRef.current) {
          stop();
          return;
        }
        stepRef.current();
      }, HOLD_REPEAT_MS);
    }, HOLD_DELAY_MS);
  };

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "flex touch-manipulation items-center justify-center rounded-md border bg-white transition-colors active:bg-slate-100 disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}
