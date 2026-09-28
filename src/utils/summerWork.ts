import type { Subject } from "@/types/result";

export const SUMMER_WORK_LABEL = "Summer Work";
export const SUMMER_WORK_TOTAL_MARKS = 50;

// The label is user-editable, so a retyped name can arrive with odd casing or
// extra inner spaces ("  SUMMER   Work "). Collapse both before comparing.
const normalize = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

export const isSummerWorkSubject = (s: Subject): boolean =>
  normalize(s.name) === normalize(SUMMER_WORK_LABEL);

export function findSummerWork(subjects: Subject[]): Subject | undefined {
  return subjects.find(isSummerWorkSubject);
}

export function splitSummerWork(subjects: Subject[]): {
  academic: Subject[];
  summerWork?: Subject;
} {
  const summerWork = findSummerWork(subjects);
  if (!summerWork) return { academic: subjects };
  // Only the first match is pulled out as the dedicated row. Any further
  // same-named rows stay in `academic`, where ResultCard still renders them as
  // normal subjects — so what is shown and what is counted always agree.
  return { academic: subjects.filter((s) => s.id !== summerWork.id), summerWork };
}
