import type { ReactNode } from "react";

export function OrdinalText({ text }: { text: string }) {
  const re = /(\d+)(\s*)(st|nd|rd|th)(?![\p{L}\p{N}])/giu;
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const [, digits = "", gap = "", suffix = ""] = m;
    parts.push(text.slice(last, m.index));
    parts.push(digits + gap);
    parts.push(
      /*
       * NOTE: callers must draw any underline with a bottom border on a wrapper,
       * never with `text-decoration`. A decoration propagates into this run, and
       * because the suffix is raised above the baseline it either rides up with
       * it and breaks the line, or has to be opted out and then leaves a gap
       * where the underline should be. A border on the enclosing text box is
       * positioned from the box rather than the runs, so it passes cleanly
       * underneath. Every underlined field on the card follows that rule, which
       * is why nothing has to opt this run out here.
       */
      <sup key={m.index} className="relative top-[-0.3em] text-[0.62em]">
        {suffix}
      </sup>,
    );
    last = m.index + m[0].length;
  }

  parts.push(text.slice(last));
  return <>{parts}</>;
}
