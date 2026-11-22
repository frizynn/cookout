const ID = /^(id|.+Id)$/;
const BARE = new Set(["TSStringKeyword", "TSNumberKeyword"]);
const bare = (annotation) => annotation && BARE.has(annotation.typeAnnotation.type);

export default {
  create(context) {
    const check = (node, name) => {
      if (ID.test(name) && bare(node.typeAnnotation)) {
        const type = node.typeAnnotation.typeAnnotation.type === "TSStringKeyword" ? "string" : "number";
        context.report({ data: { name, type }, messageId: "bare", node });
      }
    };
    return {
      Identifier(node) {
        if (node.typeAnnotation) {
          check(node, node.name);
        }
      },
      PropertyDefinition(node) {
        if (node.key.type === "Identifier") {
          check(node, node.key.name);
        }
      },
      TSPropertySignature(node) {
        if (node.key.type === "Identifier") {
          check(node, node.key.name);
        }
      },
    };
  },
  meta: {
    messages: { bare: "'{{name}}' is an ID typed as a bare {{type}}. Give it a branded type." },
    schema: [],
    type: "problem",
  },
};
