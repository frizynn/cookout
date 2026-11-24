import { plainTextOf } from "./markdown-plain-text.ts";

export function firstLineOf(text: string): string {
  const [first = ""] = text.trim().split("\n");
  return plainTextOf(first);
}
