function isNamed(node, name) {
  return (node.type === "Identifier" && node.name === name) || (node.type === "Literal" && node.value === name);
}

function isDocument(node) {
  if (node.type === "Identifier") {
    return node.name === "document";
  }
  return node.type === "MemberExpression" && isNamed(node.property, "document");
}

function isDocumentTitle(node) {
  return node.type === "MemberExpression" && isNamed(node.property, "title") && isDocument(node.object);
}

const pageTitleOwner = {
  create(context) {
    return {
      AssignmentExpression(node) {
        if (isDocumentTitle(node.left)) {
          context.report({ messageId: "title", node });
        }
      },
    };
  },
  meta: {
    messages: {
      title: "Only app/modules/page-title sets document.title. Give the page's title to usePageTitle instead.",
    },
    schema: [],
    type: "problem",
  },
};

export { pageTitleOwner };
