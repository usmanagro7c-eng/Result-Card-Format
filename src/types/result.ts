export interface Subject {
  id: string;
  name: string;
  totalMarks: number;
  obtainedMarks: number;
}

export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  className: string;
  section: string;
  session: string;
  term: string;
  subjects: Subject[];
  includeSummerWork?: boolean;
  remarks: string;
  teacherSignatureDataUrl?: string | null;
  headSignatureDataUrl?: string | null;
  createdAt: number;
}

export interface GradeRule {
  id: string;
  name: string;
  min: number;
  max: number;
}

export interface Settings {
  schoolName: string;
  schoolTagline: string;
  logoDataUrl: string | null;
  teacherSignatureDataUrl: string | null;
  headSignatureDataUrl: string | null;
  defaultSession: string;
  defaultTerm: string;
  grades: GradeRule[];
  defaultSubjects: Array<{ name: string; totalMarks: number }>;
}

export interface ResultTotals {
  grandTotal: number;
  obtainedTotal: number;
  percentage: number;
  grade: string;
}
