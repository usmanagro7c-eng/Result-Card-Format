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
  /**
   * Opt-in: when false the card renders exactly as it did before photos existed,
   * so a photo is never a forced layout change. The data may still be present
   * while this is off, which lets the teacher toggle back and forth losslessly.
   */
  showPhoto?: boolean;
  photoDataUrl?: string | null;
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
  /**
   * Unprintable band kept clear on all four sides of the sheet, in millimetres.
   * The decorative frame is the outermost ink on the page, so this is what
   * decides whether the bottom border reaches the paper at all. Optional so a
   * settings payload saved before this existed still loads; it is normalised on
   * read by `normalizePrinterMarginMm` and defaults to 10mm.
   */
  printerMarginMm?: number;
  grades: GradeRule[];
  defaultSubjects: Array<{ name: string; totalMarks: number }>;
}

export interface ResultTotals {
  grandTotal: number;
  obtainedTotal: number;
  percentage: number;
  grade: string;
}
