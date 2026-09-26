import type { GradeRule, ResultTotals, Subject } from "@/types/result";
import { resolveGrade } from "./grading";

export function calculateTotals(subjects: Subject[], grades: GradeRule[]): ResultTotals {
  const grandTotal = subjects.reduce((sum, s) => sum + (Number(s.totalMarks) || 0), 0);
  const obtainedTotal = subjects.reduce((sum, s) => sum + (Number(s.obtainedMarks) || 0), 0);
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
