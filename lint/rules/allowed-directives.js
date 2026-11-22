import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { removeComment } from "../remove-comment.js";

const DIRECTIVE =
  /^\s*(oxlint-disable(?:-next-line|-line)?|eslint-disable(?:-next-line|-line)?|@ts-expect-error|biome-ignore)\b(.*)$/;
const cache = new Map();

const allowlist = (path) => {
  if (!cache.has(path)) {
    const entries = JSON.parse(readFileSync(path, "utf8"));
    cache.set(path, new Set(entries.filter((e) => e.reason?.trim()).map((e) => `${e.file}\0${e.directive}`)));
  }
  return cache.get(path);
};

export default {
  meta: {
    type: "problem",
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: { allowlist: { type: "string" } },
        required: ["allowlist"],
        additionalProperties: false,
      },
    ],
    messages: {
      directive: "'{{directive}}' is not on the reviewed allowlist. Fix the code instead of silencing the check.",
    },
  },
  create(context) {
    const allowed = allowlist(context.options[0].allowlist);
    const file = relative(process.cwd(), context.filename);
    return {
      "Program:exit"() {
        const removal = removeComment(context.sourceCode.text);
        for (const comment of context.sourceCode.getAllComments()) {
          const match = comment.value.match(DIRECTIVE);
          if (!match) continue;
          const directive = `${match[1]}${match[2]}`.trim();
          if (!allowed.has(`${file}\0${directive}`))
            context.report({ data: { directive }, fix: removal(comment), loc: comment.loc, messageId: "directive" });
        }
      },
    };
  },
};
