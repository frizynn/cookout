export default {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      overload:
        "Overload signatures are not checked against the implementation. Use one signature, or a union of inputs with a discriminant.",
    },
  },
  create(context) {
    return {
      TSDeclareFunction(node) {
        if (!node.declare) context.report({ node, messageId: "overload" });
      },
      TSEmptyBodyFunctionExpression(node) {
        if (node.parent.type === "MethodDefinition") context.report({ node: node.parent, messageId: "overload" });
      },
    };
  },
};
