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
      <sup key={m.index} className="relative top-[-0.3em] text-[0.62em]">
        {suffix}
      </sup>,
    );
    last = m.index + m[0].length;
  }

  parts.push(text.slice(last));
  return <>{parts}</>;
}
