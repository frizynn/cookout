import { readFileSync } from "node:fs";

const cache = new Map();

const words = (name) =>
  name
    .replaceAll(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replaceAll(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2")
    .split(/[\s_$]+/u)
    .filter(Boolean)
    .map((w) => w.toLowerCase());

const avoidedTerms = (path) => {
  if (!cache.has(path)) {
    const terms = [];
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = line.match(/^_Avoid_:\s*(.+)$/u);
      if (match) {
        terms.push(...match[1].split(",").map((t) => t.trim().toLowerCase().split(/\s+/u)));
      }
    }
    cache.set(path, terms);
  }
  return cache.get(path);
};

const contains = (haystack, needle) => haystack.some((_, i) => needle.every((w, j) => haystack[i + j] === w));

export default {
  create(context) {
    const terms = avoidedTerms(context.options[0].glossary);
    return {
      Identifier(node) {
        const nameWords = words(node.name);
        const term = terms.find((t) => contains(nameWords, t));
        if (term) {
          context.report({ data: { name: node.name, term: term.join(" ") }, messageId: "avoided", node });
        }
      },
    };
  },
  meta: {
    messages: {
      avoided: "'{{name}}' uses '{{term}}', which GLOSSARY.md says to avoid. Rename it with the glossary's term.",
    },
    schema: [
      {
        additionalProperties: false,
        properties: { glossary: { type: "string" } },
        required: ["glossary"],
        type: "object",
      },
    ],
    type: "problem",
  },
};
