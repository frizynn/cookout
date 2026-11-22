export default {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      throw: "Fail in the error channel.",
      try: "Wrap non-Effect code in an adapter under lib/server/adapters/.",
    },
  },
  create(context) {
    return {
      ThrowStatement(node) {
        context.report({ node, messageId: "throw" });
      },
      TryStatement(node) {
        context.report({ node, messageId: "try" });
      },
    };
  },
};
