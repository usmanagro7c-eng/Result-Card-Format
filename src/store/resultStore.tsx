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

export const DEFAULT_SETTINGS: Settings = {
  schoolName: "The Country School",
  schoolTagline: "A project of Bloomfield Hall | Since 1984",
  logoDataUrl: null,
  teacherSignatureDataUrl: null,
  headSignatureDataUrl: null,
  defaultSession: "2026–2027",
  defaultTerm: "1st Term Examination",
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

  useEffect(() => {
    const loadedStudents = read<Student[]>(STUDENTS_KEY, []);
    setStudents(loadedStudents ?? []);
    setSettings({ ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(SETTINGS_KEY, {}) });
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));
  }, [students, ready]);

  useEffect(() => {
    if (ready) localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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
    localStorage.setItem(STUDENTS_KEY, JSON.stringify([]));
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
      updateSettings: (patch) => setSettings((prev) => ({ ...prev, ...patch })),
      clearAllStudents,
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
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useResultStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useResultStore must be used within ResultStoreProvider");
  return ctx;
}
