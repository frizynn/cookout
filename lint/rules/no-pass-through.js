const reExport = (node) =>
  (node.type === "ExportAllDeclaration" || node.type === "ExportNamedDeclaration") && node.source;
const ownModule = (node) => node.source.value.startsWith("./");

export default {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      passThrough:
        "This entry point only forwards another module. Import that module directly, or give this one behaviour of its own.",
    },
  },
  create(context) {
    return {
      Program(program) {
        const body = program.body;
        if (body.length > 0 && body.every(reExport) && !body.some(ownModule)) {
          context.report({ node: program, messageId: "passThrough" });
        }
      },
    };
  },
};
