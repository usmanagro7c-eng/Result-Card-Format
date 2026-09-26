import type { GradeRule } from "@/types/result";

export const DEFAULT_GRADES: GradeRule[] = [
  { id: "g1", name: "A+", min: 80, max: 100 },
  { id: "g2", name: "A", min: 70, max: 79.99 },
  { id: "g3", name: "B", min: 60, max: 69.99 },
  { id: "g4", name: "C", min: 50, max: 59.99 },
  { id: "g5", name: "D", min: 40, max: 49.99 },
  { id: "g6", name: "E", min: 33, max: 39.99 },
  { id: "g7", name: "F", min: 0, max: 32.99 },
];

export function resolveGrade(percentage: number, grades: GradeRule[]): string {
  if (!grades || grades.length === 0) return "—";
  // Sort descending by min threshold
  const sorted = [...grades].sort((a, b) => b.min - a.min);
  const match = sorted.find(
    (g) => percentage >= g.min && (percentage <= g.max || percentage >= 100),
  );
  if (match) return match.name;
  // If percentage is lower than lowest min, match the lowest grade
  const lowest = sorted[sorted.length - 1];
  if (lowest && percentage <= lowest.max) return lowest.name;
  return "—";
}
