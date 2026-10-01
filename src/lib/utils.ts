import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function capitalizeFirstLetter(value: string): string {
  if (!value) return value;
  return value.replace(/^(\s*)([a-z\u00E0-\u00FC])/i, (match, prefix, char) => `${prefix}${char.toUpperCase()}`);
}
