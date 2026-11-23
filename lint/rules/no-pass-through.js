const reExport = (node) =>
  (node.type === "ExportAllDeclaration" || node.type === "ExportNamedDeclaration") && node.source;
const ownModule = (node) => node.source.value.startsWith("./");

export default {
  create(context) {
    return {
      Program(program) {
        const { body } = program;
        if (body.length > 0 && body.every(reExport) && !body.some(ownModule)) {
          context.report({ messageId: "passThrough", node: program });
        }
      },
    };
  },
  meta: {
    messages: {
      passThrough:
        "This entry point only forwards another module. Import that module directly, or give this one behaviour of its own.",
    },
    schema: [],
    type: "problem",
  },
};
