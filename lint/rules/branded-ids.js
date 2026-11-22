const ID = /^(id|.+Id)$/;
const BARE = new Set(["TSStringKeyword", "TSNumberKeyword"]);
const bare = (annotation) => annotation && BARE.has(annotation.typeAnnotation.type);

export default {
  meta: {
    type: "problem",
    schema: [],
    messages: { bare: "'{{name}}' is an ID typed as a bare {{type}}. Give it a branded type." },
  },
  create(context) {
    const check = (node, name) => {
      if (ID.test(name) && bare(node.typeAnnotation)) {
        const type = node.typeAnnotation.typeAnnotation.type === "TSStringKeyword" ? "string" : "number";
        context.report({ node, messageId: "bare", data: { name, type } });
      }
    };
    return {
      TSPropertySignature(node) {
        if (node.key.type === "Identifier") check(node, node.key.name);
      },
      PropertyDefinition(node) {
        if (node.key.type === "Identifier") check(node, node.key.name);
      },
      Identifier(node) {
        if (node.typeAnnotation) check(node, node.name);
      },
    };
  },
};
