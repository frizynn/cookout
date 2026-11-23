const INTERNAL_TAG = /(?:^|\s)@internal(?![\w-])/u;

function isInternalJsDoc(comment) {
  const text = String(comment.value);
  return comment.type === "Block" && text.startsWith("*") && INTERNAL_TAG.test(text);
}

const noInternalTag = {
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (isInternalJsDoc(comment)) {
            context.report({ loc: comment.loc, messageId: "internal" });
          }
        }
      },
    };
  },
  meta: {
    messages: {
      internal:
        "No @internal tag: `knip --production` skips an export tagged @internal, so a test-only export would pass. Delete the export if only tests use it.",
    },
    schema: [],
    type: "problem",
  },
};

export { noInternalTag };
