import type { GradeRule, ResultTotals, Subject } from "@/types/result";
import { resolveGrade } from "./grading";
import { splitSummerWork } from "./summerWork";

/**
 * `includeSummerWork` is deliberately required rather than defaulted: a silent
 * default would let one call site forget the flag and quietly report totals that
 * disagree with the printed card. Making it required turns every missed caller
 * into a compile error.
 */
export function calculateTotals(
  subjects: Subject[],
  grades: GradeRule[],
  includeSummerWork: boolean,
): ResultTotals {
  const counted = includeSummerWork ? subjects : splitSummerWork(subjects).academic;
  const grandTotal = counted.reduce((sum, s) => sum + (Number(s.totalMarks) || 0), 0);
  const obtainedTotal = counted.reduce((sum, s) => sum + (Number(s.obtainedMarks) || 0), 0);
  const percentage = grandTotal > 0 ? (obtainedTotal / grandTotal) * 100 : 0;

  return {
    grandTotal,
    obtainedTotal,
    percentage: Math.round(percentage * 100) / 100,
    grade: resolveGrade(percentage, grades),
  };
}

export function subjectErrors(subjects: Subject[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const s of subjects) {
    if (!s.name.trim()) errors[s.id] = "Subject name is required.";
    else if (s.totalMarks <= 0) errors[s.id] = "Total marks must be greater than 0.";
    else if (s.obtainedMarks < 0) errors[s.id] = "Obtained marks cannot be negative.";
    else if (s.obtainedMarks > s.totalMarks)
      errors[s.id] = "Obtained marks cannot exceed total marks.";
  }
  return errors;
}
