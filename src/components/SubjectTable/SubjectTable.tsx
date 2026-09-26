import { useCallback, useEffect, useRef } from "react";
import { ArrowDown, ArrowUp, Minus, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Subject } from "@/types/result";
import { subjectErrors } from "@/utils/calculations";
import { DEFAULT_SUBJECTS, uid } from "@/store/resultStore";
import { cn } from "@/lib/utils";

interface Props {
  subjects: Subject[];
  onChange: (subjects: Subject[]) => void;
}

export function SubjectTable({ subjects, onChange }: Props) {
  const errors = subjectErrors(subjects);

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

  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[1fr_6rem_6rem_5.5rem] gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
        <span>Subject</span>
        <span className="text-center">Total Marks</span>
        <span className="text-center">Obtained Marks</span>
        <span className="text-right">Actions</span>
      </div>

      {subjects.length === 0 ? (
        <div className="space-y-3 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <p>No subjects added yet.</p>
          <Button type="button" variant="outline" size="sm" onClick={resetToStandard}>
            <RotateCcw className="size-3.5" /> Load Class Subjects
          </Button>
        </div>
      ) : null}

      <div className="space-y-2">
        {subjects.map((subject, index) => {
          const hasError = !!errors[subject.id];
          const isOverLimit = subject.obtainedMarks > subject.totalMarks;

          return (
            <div
              key={subject.id}
              className={cn(
                "rounded-md border p-2 transition-colors sm:border-0 sm:p-0",
                hasError ? "bg-destructive/5 sm:bg-transparent" : "",
              )}
            >
              {/* MOBILE: stacked card — name, then Total | Obtained(steppers), then actions */}
              <div className="space-y-2 sm:hidden">
                <Input
                  className={cn(
                    "h-11",
                    !subject.name.trim() ? "border-destructive focus-visible:ring-destructive" : "",
                  )}
                  value={subject.name}
                  placeholder="Subject name (e.g. English)"
                  aria-label="Subject name"
                  onChange={(e) => patch(subject.id, { name: e.target.value })}
                />

                <div className="grid grid-cols-[5.5rem_1fr] items-end gap-2">
                  <div>
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Total
                    </span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      enterKeyHint="next"
                      min={1}
                      className={cn(
                        "h-11 text-center font-medium",
                        subject.totalMarks <= 0
                          ? "border-destructive focus-visible:ring-destructive"
                          : "",
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

                  <div>
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Obtained
                    </span>
                    <div className="flex items-center gap-1.5">
                      <HoldButton
                        label={`Decrease ${subject.name || "subject"} marks`}
                        onStep={() => stepObtained(subject, -1)}
                        disabled={subject.obtainedMarks <= 0}
                        className="h-11 w-11 shrink-0 border-slate-200 text-slate-600"
                      >
                        <Minus className="size-4" />
                      </HoldButton>

                      <Input
                        type="number"
                        inputMode="numeric"
                        enterKeyHint="next"
                        min={0}
                        className={cn(
                          "h-11 min-w-0 flex-1 text-center text-base font-bold",
                          isOverLimit || subject.obtainedMarks < 0
                            ? "border-destructive text-destructive focus-visible:ring-destructive"
                            : "",
                        )}
                        value={subject.obtainedMarks === 0 ? "" : subject.obtainedMarks}
                        placeholder="—"
                        aria-label={`Obtained marks for ${subject.name || "subject"}`}
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
                        className="h-11 w-11 shrink-0 border-slate-200 text-slate-600"
                      >
                        <Plus className="size-4" />
                      </HoldButton>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5 border-t border-slate-100 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-11"
                    disabled={index === 0}
                    title="Move up"
                    aria-label="Move up"
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-11"
                    disabled={index === subjects.length - 1}
                    title="Move down"
                    aria-label="Move down"
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 text-destructive hover:bg-destructive/10"
                    title="Remove subject"
                    aria-label="Remove subject"
                    onClick={() => onChange(subjects.filter((s) => s.id !== subject.id))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              {/* DESKTOP: single compact row */}
              <div className="hidden grid-cols-[1fr_6rem_6rem_5.5rem] items-center gap-2 sm:grid">
                <Input
                  className={cn(
                    !subject.name.trim() ? "border-destructive focus-visible:ring-destructive" : "",
                  )}
                  value={subject.name}
                  placeholder="Subject name (e.g. English)"
                  onChange={(e) => patch(subject.id, { name: e.target.value })}
                />

                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className={cn(
                    "text-center font-medium",
                    subject.totalMarks <= 0
                      ? "border-destructive focus-visible:ring-destructive"
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
                  min={0}
                  className={cn(
                    "text-center font-bold",
                    isOverLimit || subject.obtainedMarks < 0
                      ? "border-destructive text-destructive focus-visible:ring-destructive"
                      : "",
                  )}
                  value={subject.obtainedMarks === 0 ? "" : subject.obtainedMarks}
                  placeholder="Obtained"
                  onChange={(e) =>
                    patch(subject.id, {
                      obtainedMarks: e.target.value === "" ? 0 : Number(e.target.value),
                    })
                  }
                />

                <div className="flex justify-end gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8"
                    disabled={index === 0}
                    title="Move up"
                    aria-label="Move up"
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8"
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
                    className="size-8 text-destructive hover:bg-destructive/10"
                    title="Remove subject"
                    aria-label="Remove subject"
                    onClick={() => onChange(subjects.filter((s) => s.id !== subject.id))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              {errors[subject.id] ? (
                <p className="mt-1 px-1 text-xs font-medium text-destructive">
                  {errors[subject.id]}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-11 sm:min-h-8"
          onClick={() =>
            onChange([...subjects, { id: uid(), name: "", totalMarks: 50, obtainedMarks: 0 }])
          }
        >
          <Plus className="size-4" /> Add Subject
        </Button>

        {subjects.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 text-xs text-muted-foreground sm:min-h-8"
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
