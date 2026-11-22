const CHARS_PER_TOKEN = 4;

export default {
  create(context) {
    const { max } = context.options[0];
    return {
      Program(program) {
        const tokens = Math.ceil(context.sourceCode.text.length / CHARS_PER_TOKEN);
        if (tokens > max) {
          context.report({ data: { max, tokens }, messageId: "tooLong", node: program });
        }
      },
    };
  },
  meta: {
    messages: { tooLong: "About {{tokens}} tokens, over the {{max}}-token budget. Split the file along a seam." },
    schema: [
      { additionalProperties: false, properties: { max: { type: "integer" } }, required: ["max"], type: "object" },
    ],
    type: "suggestion",
  },
};
