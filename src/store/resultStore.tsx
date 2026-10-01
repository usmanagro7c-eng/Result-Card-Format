import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Settings, Student, Subject } from "@/types/result";
import { DEFAULT_GRADES } from "@/utils/grading";
import { DEFAULT_PRINTER_MARGIN_MM, normalizePrinterMarginMm } from "@/lib/cardGeometry";

const STUDENTS_KEY = "result-card.students.v1";
const SETTINGS_KEY = "result-card.settings.v1";

export const DEFAULT_SUBJECTS = [
  { name: "English", totalMarks: 75 },
  { name: "Math", totalMarks: 75 },
  { name: "Urdu", totalMarks: 75 },
  { name: "Tarjama tul Quran", totalMarks: 50 },
  { name: "Pak Studies", totalMarks: 50 },
  { name: "Physics", totalMarks: 60 },
  { name: "Chemistry", totalMarks: 60 },
  { name: "Biology / Computer", totalMarks: 50 },
];

export const PRESET_REMARKS = [
  "Excellent performance.",
  "Good effort! Work harder to achieve your goal.",
  "Need more concentration.",
  "Need more hard work.",
  "Satisfactory. Need more concentration.",
  "Unsatisfactory. Need more concentration.",
];

export const FIXED_SCHOOL_NAME = "The Country School";
export const FIXED_SCHOOL_TAGLINE = "A project of Bloomfield Hall | Since 1984";
export const FIXED_SCHOOL_LOGO = "/TCS Logo.png";

export const DEFAULT_SETTINGS: Settings = {
  schoolName: FIXED_SCHOOL_NAME,
  schoolTagline: FIXED_SCHOOL_TAGLINE,
  logoDataUrl: FIXED_SCHOOL_LOGO,
  teacherSignatureDataUrl: null,
  headSignatureDataUrl: null,
  defaultSession: "2026–2027",
  defaultTerm: "1st Term Examination",
  printerMarginMm: DEFAULT_PRINTER_MARGIN_MM,
  grades: DEFAULT_GRADES,
  defaultSubjects: DEFAULT_SUBJECTS,
};

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function makeSubjects(defaults: Settings["defaultSubjects"]): Subject[] {
  return defaults.map((d) => ({
    id: uid(),
    name: d.name,
    totalMarks: d.totalMarks,
    obtainedMarks: 0,
  }));
}

export function createStudent(settings: Settings, partial?: Partial<Student>): Student {
  return {
    id: uid(),
    name: partial?.name || "",
    rollNumber: partial?.rollNumber || "",
    className: partial?.className || "10th",
    section: partial?.section || "A",
    session: partial?.session || settings.defaultSession,
    term: partial?.term || settings.defaultTerm,
    subjects: partial?.subjects || makeSubjects(settings.defaultSubjects),
    includeSummerWork: partial?.includeSummerWork ?? false,
    showPhoto: partial?.showPhoto ?? false,
    photoDataUrl: partial?.photoDataUrl ?? null,
    remarks: partial?.remarks || "",
    teacherSignatureDataUrl: partial?.teacherSignatureDataUrl ?? null,
    headSignatureDataUrl: partial?.headSignatureDataUrl ?? null,
    createdAt: Date.now(),
  };
}

interface StoreValue {
  ready: boolean;
  students: Student[];
  settings: Settings;
  addStudent: (student: Student) => void;
  updateStudent: (id: string, patch: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  duplicateStudent: (id: string) => Student | undefined;
  getStudent: (id: string) => Student | undefined;
  updateSettings: (patch: Partial<Settings>) => void;
  clearAllStudents: () => void;
  /** True when the last save failed, e.g. localStorage is full. */
  storageFull: boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function ResultStoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [storageFull, setStorageFull] = useState(false);

  useEffect(() => {
    // Students are stored as raw JSON with no schema version, so records written
    // before `includeSummerWork` / `showPhoto` existed have no such keys.
    // Normalise on load rather than defaulting at every read site; the save
    // effect below then persists the backfilled values.
    const loadedStudents = read<Student[]>(STUDENTS_KEY, []);
    setStudents(
      (loadedStudents ?? []).map((s) => ({
        ...s,
        includeSummerWork: s.includeSummerWork ?? false,
        showPhoto: s.showPhoto ?? false,
        photoDataUrl: s.photoDataUrl ?? null,
      })),
    );
    // The spread backfills fields that did not exist when the payload was saved;
    // the printer margin is then coerced, because it is read straight into the
    // card's padding and an unrecognised value would become a random margin.
    const storedSettings = read<Partial<Settings>>(SETTINGS_KEY, {});
    setSettings({
      ...DEFAULT_SETTINGS,
      ...storedSettings,
      schoolName: FIXED_SCHOOL_NAME,
      schoolTagline: FIXED_SCHOOL_TAGLINE,
      logoDataUrl: FIXED_SCHOOL_LOGO,
      printerMarginMm: normalizePrinterMarginMm(storedSettings.printerMarginMm),
    });
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    // `setItem` throws QuotaExceededError once the ~5MB origin budget is gone.
    // Left unhandled it would abort this effect and silently stop every future
    // save, so the failure is surfaced instead (editor shows a storage banner).
    try {
      localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));
      setStorageFull(false);
    } catch {
      setStorageFull(true);
    }
  }, [students, ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      setStorageFull(true);
    }
  }, [settings, ready]);

  const addStudent = useCallback((student: Student) => {
    setStudents((prev) => [student, ...prev]);
  }, []);

  const updateStudent = useCallback((id: string, patch: Partial<Student>) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const deleteStudent = useCallback((id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const duplicateStudent = useCallback(
    (id: string) => {
      const target = students.find((s) => s.id === id);
      if (!target) return undefined;
      const copy: Student = {
        ...target,
        id: uid(),
        name: `${target.name} (Copy)`.trim(),
        rollNumber: target.rollNumber ? `${target.rollNumber}-C` : "",
        createdAt: Date.now(),
        subjects: target.subjects.map((sub) => ({ ...sub, id: uid() })),
      };
      setStudents((prev) => [copy, ...prev]);
      return copy;
    },
    [students],
  );

  const clearAllStudents = useCallback(() => {
    setStudents([]);
    // Freeing space is the remedy for `storageFull`, so swallow a failure here
    // rather than letting it escape as an unhandled error.
    try {
      localStorage.setItem(STUDENTS_KEY, JSON.stringify([]));
      setStorageFull(false);
    } catch {
      setStorageFull(true);
    }
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      students,
      settings,
      addStudent,
      updateStudent,
      deleteStudent,
      duplicateStudent,
      getStudent: (id: string) => students.find((s) => s.id === id),
      updateSettings: (patch) =>
        setSettings((prev) => ({
          ...prev,
          ...patch,
          schoolName: FIXED_SCHOOL_NAME,
          schoolTagline: FIXED_SCHOOL_TAGLINE,
          logoDataUrl: FIXED_SCHOOL_LOGO,
        })),
      clearAllStudents,
      storageFull,
    }),
    [
      ready,
      students,
      settings,
      addStudent,
      updateStudent,
      deleteStudent,
      duplicateStudent,
      clearAllStudents,
      storageFull,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useResultStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useResultStore must be used within ResultStoreProvider");
  return ctx;
}
