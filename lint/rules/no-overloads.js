export default {
  create(context) {
    return {
      TSDeclareFunction(node) {
        if (!node.declare) {
          context.report({ messageId: "overload", node });
        }
      },
      TSEmptyBodyFunctionExpression(node) {
        if (node.parent.type === "MethodDefinition") {
          context.report({ messageId: "overload", node: node.parent });
        }
      },
    };
  },
  meta: {
    messages: {
      overload:
        "Overload signatures are not checked against the implementation. Use one signature, or a union of inputs with a discriminant.",
    },
    schema: [],
    type: "problem",
  },
};
