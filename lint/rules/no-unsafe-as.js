const isConst = (node) =>
  node.typeAnnotation.type === "TSTypeReference" &&
  node.typeAnnotation.typeName.type === "Identifier" &&
  node.typeAnnotation.typeName.name === "const";
const FUNCTIONS = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);
const insideGeneric = (node) => {
  for (let n = node.parent; n; n = n.parent) {
    if (FUNCTIONS.has(n.type) && n.typeParameters?.params.length) return true;
  }
  return false;
};

export default {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      assertion: "Narrow the type instead of asserting it. Assertions are allowed only inside a generic function.",
    },
  },
  create(context) {
    const check = (node) => {
      if (!isConst(node) && !insideGeneric(node)) context.report({ node, messageId: "assertion" });
    };
    return { TSAsExpression: check, TSTypeAssertion: check };
  },
};
