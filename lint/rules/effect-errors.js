export default {
  create(context) {
    return {
      ThrowStatement(node) {
        context.report({ messageId: "throw", node });
      },
      TryStatement(node) {
        context.report({ messageId: "try", node });
      },
    };
  },
  meta: {
    messages: {
      throw: "Fail in the error channel.",
      try: "Wrap non-Effect code in an adapter under lib/server/adapters/.",
    },
    schema: [],
    type: "problem",
  },
};
