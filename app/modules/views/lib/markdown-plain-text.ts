import { plainTextOfTree } from "./markdown-tree.ts";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

const PARSER = unified().use(remarkParse).use(remarkGfm);

export function plainTextOf(text: string): string {
  return plainTextOfTree(PARSER.parse(text));
}
