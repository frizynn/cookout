import { readFileSync } from "node:fs";

const cache = new Map();

const words = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2")
    .split(/[\s_$]+/u)
    .filter(Boolean)
    .map((w) => w.toLowerCase());

const avoidedTerms = (path) => {
  if (!cache.has(path)) {
    const terms = [];
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = line.match(/^_Avoid_:\s*(.+)$/u);
      if (match) terms.push(...match[1].split(",").map((t) => t.trim().toLowerCase().split(/\s+/u)));
    }
    cache.set(path, terms);
  }
  return cache.get(path);
};

const contains = (haystack, needle) => haystack.some((_, i) => needle.every((w, j) => haystack[i + j] === w));

export default {
  meta: {
    type: "problem",
    schema: [
      {
        type: "object",
        properties: { glossary: { type: "string" } },
        required: ["glossary"],
        additionalProperties: false,
      },
    ],
    messages: {
      avoided: "'{{name}}' uses '{{term}}', which GLOSSARY.md says to avoid. Rename it with the glossary's term.",
    },
  },
  create(context) {
    const terms = avoidedTerms(context.options[0].glossary);
    return {
      Identifier(node) {
        const nameWords = words(node.name);
        const term = terms.find((t) => contains(nameWords, t));
        if (term) context.report({ node, messageId: "avoided", data: { name: node.name, term: term.join(" ") } });
      },
    };
  },
};
