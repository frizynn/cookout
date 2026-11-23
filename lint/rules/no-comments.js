import { removeComment } from "../remove-comment.js";

const DIRECTIVE = /^\s*(oxlint-disable|oxlint-enable|eslint-disable|eslint-enable|@ts-expect-error|biome-ignore)/;
const isJsDoc = (comment) => comment.type === "Block" && comment.value.startsWith("*");
const isShebang = (comment) => comment.type === "Shebang";

const DOCUMENTABLE = new Set([
  "MethodDefinition",
  "PropertyDefinition",
  "Property",
  "TSMethodSignature",
  "TSPropertySignature",
]);

const isExported = (node) => {
  for (let n = node; n; n = n.parent) {
    if (n.type === "ExportNamedDeclaration" || n.type === "ExportDefaultDeclaration") {
      return true;
    }
  }
  return false;
};

export default {
  create(context) {
    const allowJsDoc = context.options[0]?.allowInterfaceJsDoc === true;
    const allowed = new Set();
    const allowLastJsDocBefore = (node) => {
      const jsDoc = context.sourceCode.getCommentsBefore(node).filter(isJsDoc).at(-1);
      if (jsDoc) {
        allowed.add(jsDoc);
      }
    };
    const visitors = {
      "Program:exit"() {
        const removal = removeComment(context.sourceCode.text);
        for (const comment of context.sourceCode.getAllComments()) {
          if (isShebang(comment) || DIRECTIVE.test(comment.value) || allowed.has(comment)) {
            continue;
          }
          context.report({
            loc: comment.loc,
            messageId: "comment",
            suggest: [{ fix: removal(comment), messageId: "remove" }],
          });
        }
      },
    };
    if (allowJsDoc) {
      visitors.Program = (program) => {
        const first = context.sourceCode.getAllComments().find((comment) => !isShebang(comment));
        const firstCode = program.body[0];
        if (first && isJsDoc(first) && (!firstCode || first.range[1] <= firstCode.range[0])) {
          allowed.add(first);
        }
      };
      visitors.ExportNamedDeclaration = allowLastJsDocBefore;
      visitors.ExportDefaultDeclaration = allowLastJsDocBefore;
      for (const type of DOCUMENTABLE) {
        visitors[type] = (node) => {
          if (isExported(node)) {
            allowLastJsDocBefore(node);
          }
        };
      }
    }
    return visitors;
  },
  meta: {
    hasSuggestions: true,
    messages: {
      comment: "Delete this comment: a tautology, excuse, or stale note goes; a decision record moves to an ADR.",
      remove: "Delete the comment.",
    },
    schema: [{ additionalProperties: false, properties: { allowInterfaceJsDoc: { type: "boolean" } }, type: "object" }],
    type: "suggestion",
  },
};
