const ROLE_QUERIES = new Set([
  "findAllByRole",
  "findByRole",
  "getAllByRole",
  "getByRole",
  "queryAllByRole",
  "queryByRole",
]);
const SCOPED_ROLES = new Set(["alert", "button", "link"]);
const DEFAULT_PAGES = ["page", "screen"];
const NO_ROLE = "";

function nameOf(node) {
  if (node.type === "Identifier") {
    return node.name;
  }
  if (node.type === "MemberExpression" && node.property.type === "Identifier" && node.computed === false) {
    return node.property.name;
  }
  return NO_ROLE;
}

function roleOf(call) {
  const [role = { type: "None" }] = call.arguments;
  if (role.type !== "Literal" || typeof role.value !== "string") {
    return NO_ROLE;
  }
  return role.value;
}

function queryOf(callee) {
  if (callee.type !== "MemberExpression" || callee.property.type !== "Identifier" || callee.computed === true) {
    return NO_ROLE;
  }
  return callee.property.name;
}

function pagesOf(options) {
  const [settings = { pages: DEFAULT_PAGES }] = options;
  return new Set(settings.pages);
}

function isPageWide(call, pages) {
  return (
    ROLE_QUERIES.has(queryOf(call.callee)) && SCOPED_ROLES.has(roleOf(call)) && pages.has(nameOf(call.callee.object))
  );
}

const regionLookups = {
  create(context) {
    const pages = pagesOf(context.options);
    return {
      CallExpression(node) {
        if (isPageWide(node, pages) === true) {
          context.report({ data: { role: roleOf(node) }, messageId: "pageWide", node });
        }
      },
    };
  },
  meta: {
    messages: {
      pageWide:
        "This looks up a {{role}} across the whole page, which breaks when the layout shows it twice. Look it up through a region helper (inSidebar, inPane, inThread, inProfile, inTopBar) or, for an alert, alertSaying or alertsShown.",
    },
    schema: [
      {
        additionalProperties: false,
        properties: { pages: { items: { type: "string" }, type: "array" } },
        type: "object",
      },
    ],
    type: "problem",
  },
};

export { regionLookups };
