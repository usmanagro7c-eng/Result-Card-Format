import type { ReactNode } from "react";

/**
 * A raised run of text. Ordinal suffixes and grade signs are the same visual
 * treatment, so both go through this one component rather than repeating the
 * offset and the scale.
 *
 * `relative top` shifts the run visually but leaves it in the flow, so raising
 * a sign never changes the line box height. That is what lets a raised sign sit
 * high in a grade without pushing the card onto a second page.
 *
 * NOTE: callers must draw any underline with a bottom border on a wrapper,
 * never with `text-decoration`. A decoration propagates into this run, and
 * because the run is raised above the baseline it either rides up with it and
 * breaks the line, or has to be opted out and then leaves a gap where the
 * underline should be. A border on the enclosing text box is positioned from
 * the box rather than the runs, so it passes cleanly underneath. Every
 * underlined field on the card follows that rule, which is why nothing has to
 * opt this run out here.
 */
export function Raised({ children }: { children: ReactNode }) {
  return <sup className="relative top-[-0.3em] text-[0.62em]">{children}</sup>;
}

/**
 * Grade names are free text that a school edits in Settings ("A+", "B-", "A1",
 * "Excellent"), so only a trailing run of + or - is treated as a sign worth
 * raising. Anything else is returned untouched, which keeps custom names
 * readable instead of mangling whatever happens to be typed last.
 *
 * The trailing whitespace is captured and re-emitted rather than trimmed so a
 * name that picked up a stray space in Settings still renders correctly.
 */
export function GradeText({ text }: { text: string }) {
  const m = /([+-]+)(\s*)$/.exec(text);
  if (!m) return <>{text}</>;
  return (
    <>
      {text.slice(0, m.index)}
      <Raised>{m[1]}</Raised>
      {m[2]}
    </>
  );
}

export function OrdinalText({ text }: { text: string }) {
  const re = /(\d+)(\s*)(st|nd|rd|th)(?![\p{L}\p{N}])/giu;
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const [, digits = "", gap = "", suffix = ""] = m;
    parts.push(text.slice(last, m.index));
    parts.push(digits + gap);
    parts.push(<Raised key={m.index}>{suffix}</Raised>);
    last = m.index + m[0].length;
  }

  parts.push(text.slice(last));
  return <>{parts}</>;
}
