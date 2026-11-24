const MOVES_A_CLOCK = "moveClockForward";
const NOT_A_NAME = "";

function calleeName(callee) {
  if (callee.type === "Identifier") {
    return callee.name;
  }
  if (callee.type === "MemberExpression" && callee.property.type === "Identifier" && callee.computed === false) {
    return callee.property.name;
  }
  return NOT_A_NAME;
}

const ownClock = {
  create(context) {
    return {
      CallExpression(node) {
        if (calleeName(node.callee) === MOVES_A_CLOCK) {
          context.report({ messageId: "sharedClock", node });
        }
      },
    };
  },
  meta: {
    messages: {
      sharedClock:
        "A browser test that calls moveClockForward can move the shared server's clock, and days passing there break the other tests on it. Use the ownCookout fixture from clock.ts: it starts the test's own server, and its daysPass moves that server's clock.",
    },
    schema: [],
    type: "problem",
  },
};

export { ownClock };
