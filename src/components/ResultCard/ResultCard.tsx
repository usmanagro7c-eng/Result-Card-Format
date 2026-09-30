import { forwardRef } from "react";
import type { Settings, Student, Subject } from "@/types/result";
import { calculateTotals } from "@/utils/calculations";
import { OrdinalText } from "@/utils/raisedText";
import { splitSummerWork } from "@/utils/summerWork";
import { cn } from "@/lib/utils";

export interface ResultCardProps {
  student: Student;
  subjects?: Subject[];
  settings: Settings;
  includeSummerWork?: boolean;
  className?: string;
}

function DefaultSchoolEmblem() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="size-20 text-neutral-900"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="46" strokeWidth="1.8" />
      <circle cx="50" cy="50" r="42" strokeWidth="0.8" />
      {/* Star at top */}
      <polygon
        points="50,16 52.2,22.8 59.4,22.8 53.6,27 55.8,33.8 50,29.6 44.2,33.8 46.4,27 40.6,22.8 47.8,22.8"
        fill="currentColor"
      />
      {/* Open Book of Knowledge */}
      <path
        d="M28 44 C34 40 45 41 50 46 C55 41 66 40 72 44 C72 58 52 64 50 64 C48 64 28 58 28 44 Z"
        strokeWidth="1.6"
        fill="#fafafa"
      />
      <line x1="50" y1="46" x2="50" y2="64" strokeWidth="1.6" />
      <path d="M33 48 C39 46 45 47 48 50" strokeWidth="1" />
      <path d="M67 48 C61 46 55 47 52 50" strokeWidth="1" />
      <path d="M33 53 C39 51 45 52 48 55" strokeWidth="1" />
      <path d="M67 53 C61 51 55 52 52 55" strokeWidth="1" />
      {/* Laurel Wreath */}
      <path d="M22 55 C22 72 35 81 50 81 C65 81 78 72 78 55" strokeWidth="1.4" />
      <circle cx="23" cy="58" r="1.5" fill="currentColor" />
      <circle cx="28" cy="67" r="1.5" fill="currentColor" />
      <circle cx="36" cy="74" r="1.5" fill="currentColor" />
      <circle cx="64" cy="74" r="1.5" fill="currentColor" />
      <circle cx="72" cy="67" r="1.5" fill="currentColor" />
      <circle cx="77" cy="58" r="1.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Pure presentational A4 progress report.
 * Conforms exactly to the 10th Class Progress Report format.
 * Contains no app controls so it can be safely used for single printing,
 * bulk PDF export, and live editing preview.
 *
 * Notice: All tracking-* (letter-spacing) classes are intentionally avoided
 * to guarantee that html2canvas rasterizes characters without word overlap.
 */
export const ResultCard = forwardRef<HTMLDivElement, ResultCardProps>(function ResultCard(
  { student, subjects: propSubjects, settings, includeSummerWork = false, className = "" },
  ref,
) {
  const subjects = propSubjects ?? student.subjects;
  const { academic, summerWork } = splitSummerWork(subjects);
  const totals = calculateTotals(subjects, settings.grades, includeSummerWork);
  // Colour must be applied per-cell rather than on <tr>: every <td> carries its
  // own text-neutral-* class, and a row-level colour would lose to it. Italic is
  // safe on the row (no cell sets font-style) and is set inline so html2canvas
  // cannot miss it when rasterising the PDF.
  const summerDimColor = includeSummerWork ? "" : "text-neutral-500";

  const teacherSig = student.teacherSignatureDataUrl || settings.teacherSignatureDataUrl;
  const headSig = student.headSignatureDataUrl || settings.headSignatureDataUrl;
  // Read straight off the student rather than taking a prop: the photo has no
  // override case (unlike the subjects prop), so all five call sites â€” editor
  // preview, print sheet, bulk print and both PDF renders â€” pick it up for free.
  const showPhoto = student.showPhoto ?? false;
  const photoDataUrl = student.photoDataUrl ?? null;

  return (
    <div
      ref={ref}
      data-result-card
      className={`a4-page relative flex flex-col justify-between bg-white text-neutral-950 font-doc leading-normal ${className}`}
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "10mm 12mm",
        boxSizing: "border-box",
        letterSpacing: "0px",
        wordSpacing: "normal",
      }}
    >
      {/* Outer Decorative Border Frame */}
      <div className="pointer-events-none absolute inset-[7mm] border-[2px] border-neutral-900" />
      <div className="pointer-events-none absolute inset-[8.5mm] border-[0.75px] border-neutral-900" />

      {/* Main Document Content inside inner frame */}
      <div className="relative z-10 flex h-full flex-col justify-between px-[5mm] py-[4mm]">
        {/* Header Section */}
        <header className="text-center">
          <div className="flex items-center justify-center gap-4">
            {settings.logoDataUrl ? (
              <img
                src={settings.logoDataUrl}
                alt="School Logo"
                className="h-20 w-20 object-contain"
              />
            ) : (
              <DefaultSchoolEmblem />
            )}
            <div className="text-center">
              <h1 className="text-[27px] font-bold uppercase leading-tight font-doc text-neutral-900">
                {settings.schoolName || "The Country School"}
              </h1>
              {settings.schoolTagline ? (
                <p className="text-[13px] text-neutral-700 italic font-sans font-medium mt-0.5">
                  {settings.schoolTagline}
                </p>
              ) : null}
            </div>
          </div>

          <div className="my-2 flex items-center justify-center">
            <div className="h-[1.5px] w-full max-w-[95%] bg-neutral-900" />
          </div>

          <div className={cn(showPhoto && "grid grid-cols-[1fr_auto_1fr] items-center gap-4")}>
            {showPhoto ? (
              /*
               * The title block below is naturally ~91px tall, so a 28mm
               * (106px) box only grows the header by ~15px. The photo therefore
               * costs far less vertical budget here than it would beside the
               * name row, where it would have forced that row from 43px to 105px.
               * The box stays fixed rather than sharing the row, so growing the
               * photo can never push the sheet onto a second A4 page.
               */
              <div className="h-[28mm] w-[21mm] shrink-0 justify-self-start overflow-hidden border border-neutral-900 bg-white">
                {photoDataUrl ? (
                  <img
                    src={photoDataUrl}
                    alt="Student photo"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-wide text-neutral-400">
                    Photo
                  </span>
                )}
              </div>
            ) : null}

            {/*
             * Three equal outer columns with the title in the middle one, so the
             * title stays centred on the *page* rather than drifting right into
             * whatever space the photo leaves behind. The trailing spacer is what
             * balances the photo's column; without it the title would sit off
             * centre whenever the photo is shown.
             */}
            <div className="space-y-1">
              <h2 className="text-[25px] font-black uppercase text-neutral-900">
                <span className="border-b-[2px] border-neutral-900 pb-0.5">Progress Report</span>
              </h2>
              {/*
               * The underline is a border, not `text-decoration`. A decoration
               * propagates into the raised <sup> inside OrdinalText, and because
               * that suffix sits above the baseline the decoration either rode up
               * with it (breaking the line) or, once opted out, vanished and left
               * a gap. A single border spanning the whole text is immune to
               * both: it is positioned from the text box, not from the runs.
               * The same technique is already used for the title above.
               */}
              <p className="text-[17px] font-bold text-neutral-900 pt-1">
                <span className="inline-block border-b border-neutral-900 pb-[1px]">
                  <OrdinalText text={student.term || "1st Term Examination"} />
                </span>
              </p>
              <p className="text-[14px] font-semibold italic text-neutral-800">
                Session {student.session || "2026â€“2027"}
              </p>
            </div>

            {showPhoto ? <div aria-hidden="true" /> : null}
          </div>
        </header>

        {/* Student Information Section - Only Name and Class */}
        <section className="mt-4 rounded-none border border-neutral-900 bg-neutral-50/50 px-4 py-2.5 text-[15px]">
          <div className="grid grid-cols-2 gap-x-8 font-medium">
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-neutral-900">Name:</span>
              <span className="font-semibold text-neutral-950 flex-1">
                <span className="inline-block border-b border-dotted border-neutral-950 pb-[1px]">
                  {student.name || "â€”"}
                </span>
              </span>
            </div>
            <div className="flex items-baseline justify-end gap-2 text-right">
              <span className="font-bold text-neutral-900">Class:</span>
              <span className="font-semibold text-neutral-950">
                <span className="inline-block border-b border-dotted border-neutral-950 pb-[1px]">
                  <OrdinalText text={student.className || "10th"} />
                </span>
              </span>
            </div>
          </div>
        </section>

        {/* Subject Marks Table */}
        <section className="mt-4">
          <table className="w-full border-collapse border border-neutral-900 text-[17px]">
            <thead>
              <tr className="bg-neutral-100/80 text-neutral-900">
                <th className="w-[10%] border border-neutral-900 px-2 py-1.5 text-center text-[14.5px] font-bold">
                  Sr. No.
                </th>
                <th className="border border-neutral-900 px-3 py-1.5 text-center font-bold">
                  Subject
                </th>
                <th className="w-[24%] border border-neutral-900 px-3 py-1.5 text-center font-bold">
                  Total Marks
                </th>
                <th className="w-[24%] border border-neutral-900 px-3 py-1.5 text-center font-bold">
                  Obtained Marks
                </th>
              </tr>
            </thead>
            <tbody>
              {subjects.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="border border-neutral-900 px-3 py-8 text-center text-neutral-500 italic"
                  >
                    No subjects recorded.
                  </td>
                </tr>
              ) : (
                <>
                  {academic.map((sub, index) => (
                    <tr key={sub.id} className={index % 2 === 1 ? "bg-neutral-50/40" : "bg-white"}>
                      <td className="border border-neutral-900 px-2 py-1.5 text-center font-semibold text-neutral-800">
                        {index + 1}
                      </td>
                      <td className="border border-neutral-900 px-3 py-1.5 text-left font-bold text-neutral-900">
                        {sub.name || "â€”"}
                      </td>
                      <td className="border border-neutral-900 px-3 py-1.5 text-center font-semibold text-neutral-900">
                        {sub.totalMarks}
                      </td>
                      <td className="border border-neutral-900 px-3 py-1.5 text-center font-bold text-neutral-950">
                        {sub.obtainedMarks}
                      </td>
                    </tr>
                  ))}

                  {summerWork ? (
                    <tr
                      className={includeSummerWork ? "bg-white" : "bg-neutral-50/40"}
                      style={includeSummerWork ? undefined : { fontStyle: "italic" }}
                    >
                      <td
                        className={cn(
                          "border border-neutral-900 px-2 py-1.5 text-center font-semibold text-neutral-800",
                          summerDimColor,
                        )}
                      >
                        {academic.length + 1}
                      </td>
                      <td
                        className={cn(
                          "border border-neutral-900 px-3 py-1.5 text-left font-bold text-neutral-900",
                          summerDimColor,
                        )}
                      >
                        {summerWork.name || "â€”"}
                      </td>
                      <td
                        className={cn(
                          "border border-neutral-900 px-3 py-1.5 text-center font-semibold text-neutral-900",
                          summerDimColor,
                        )}
                      >
                        {summerWork.totalMarks}
                      </td>
                      <td
                        className={cn(
                          "border border-neutral-900 px-3 py-1.5 text-center font-bold text-neutral-950",
                          summerDimColor,
                        )}
                      >
                        {summerWork.obtainedMarks}
                      </td>
                    </tr>
                  ) : null}
                </>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-neutral-100/90 font-bold text-neutral-900">
                <td
                  colSpan={2}
                  className="border border-neutral-900 px-3 py-1.5 text-right uppercase"
                >
                  Grand Total
                </td>
                <td className="border border-neutral-900 px-3 py-1.5 text-center text-[18px]">
                  {totals.grandTotal}
                </td>
                <td className="border border-neutral-900 px-3 py-1.5 text-center text-[18px] font-black">
                  {totals.obtainedTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* Academic Performance Summary Box */}
        <section className="mt-4">
          <div className="grid grid-cols-4 border-2 border-neutral-900 text-center divide-x-2 divide-neutral-900 bg-white">
            <div className="p-2">
              <span className="block text-[11.5px] uppercase text-neutral-700 font-sans font-bold">
                Grand Total
              </span>
              <span className="text-[18px] font-black text-neutral-900 font-doc">
                {totals.grandTotal}
              </span>
            </div>
            <div className="p-2">
              <span className="block text-[11.5px] uppercase text-neutral-700 font-sans font-bold">
                Obtained Marks
              </span>
              <span className="text-[18px] font-black text-neutral-900 font-doc">
                {totals.obtainedTotal}
              </span>
            </div>
            <div className="p-2">
              <span className="block text-[11.5px] uppercase text-neutral-700 font-sans font-bold">
                Percentage
              </span>
              <span className="text-[18px] font-black text-neutral-900 font-doc">
                {totals.percentage}%
              </span>
            </div>
            <div className="p-2 bg-neutral-100/60">
              <span className="block text-[11.5px] uppercase text-neutral-700 font-sans font-bold">
                Grade
              </span>
              <span className="text-[19px] font-black text-neutral-950 font-doc">
                {totals.grade}
              </span>
            </div>
          </div>
        </section>

        {/* Remarks Section */}
        <section className="mt-4 rounded-none border border-neutral-900 p-2.5 bg-neutral-50/30">
          <div className="flex items-start gap-2">
            <span className="font-bold text-[14.5px] text-neutral-900 uppercase whitespace-nowrap">
              Remarks:
            </span>
            <span className="text-[14.5px] font-semibold italic text-neutral-900 underline underline-offset-4 decoration-neutral-400">
              {student.remarks ? `"${student.remarks}"` : "â€”"}
            </span>
          </div>
        </section>

        {/* Signatures Section */}
        <section className="mt-8 pt-6">
          <div className="grid grid-cols-2 gap-12 text-center text-[14.5px]">
            {/* Teacher's Signature */}
            <div className="flex flex-col items-center justify-end">
              <div className="h-12 w-48 flex items-end justify-center mb-1">
                {teacherSig ? (
                  <img
                    src={teacherSig}
                    alt="Teacher signature"
                    className="max-h-12 max-w-full object-contain"
                  />
                ) : null}
              </div>
              <div className="w-48 border-b-[1.5px] border-neutral-900" />
              <p className="mt-1 font-bold text-neutral-900 uppercase text-[13px]">
                Teacher&rsquo;s Signature
              </p>
            </div>

            {/* Head's Signature */}
            <div className="flex flex-col items-center justify-end">
              <div className="h-12 w-48 flex items-end justify-center mb-1">
                {headSig ? (
                  <img
                    src={headSig}
                    alt="Head signature"
                    className="max-h-12 max-w-full object-contain"
                  />
                ) : null}
              </div>
              <div className="w-48 border-b-[1.5px] border-neutral-900" />
              <p className="mt-1 font-bold text-neutral-900 uppercase text-[13px]">
                Head&rsquo;s Signature
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
});
