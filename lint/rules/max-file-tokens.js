const CHARS_PER_TOKEN = 4;

export default {
  meta: {
    type: "suggestion",
    schema: [
      { type: "object", properties: { max: { type: "integer" } }, required: ["max"], additionalProperties: false },
    ],
    messages: { tooLong: "About {{tokens}} tokens, over the {{max}}-token budget. Split the file along a seam." },
  },
  create(context) {
    const { max } = context.options[0];
    return {
      Program(program) {
        const tokens = Math.ceil(context.sourceCode.text.length / CHARS_PER_TOKEN);
        if (tokens > max) context.report({ node: program, messageId: "tooLong", data: { tokens, max } });
      },
    };
  },
};
