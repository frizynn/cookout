const SYNTAX = ["None", "All", "Multiple", "Single"];
const NONE = 0;
const ALL = 1;
const MULTIPLE = 2;
const SINGLE = 3;
const FIRST = 0;
const NEXT = 1;
const BEFORE = -1;
const SAME = 0;
const AFTER = 1;
const BETWEEN_DECLARATIONS = /^\s*$/u;
const BETWEEN_MEMBERS = /^\s*,\s*$/u;

function syntaxOf(declaration) {
  if (declaration.specifiers.length === NONE) {
    return NONE;
  }
  if (declaration.specifiers[FIRST].type === "ImportNamespaceSpecifier") {
    return ALL;
  }
  if (declaration.specifiers.length > NEXT) {
    return MULTIPLE;
  }
  return SINGLE;
}

function nameOf(node) {
  if (node.type === "ImportDeclaration") {
    if (node.specifiers.length === NONE) {
      return "";
    }
    return node.specifiers[FIRST].local.name;
  }
  return node.local.name;
}

function byName(left, right) {
  if (nameOf(left) < nameOf(right)) {
    return BEFORE;
  }
  if (nameOf(left) > nameOf(right)) {
    return AFTER;
  }
  return SAME;
}

function byDeclarationOrder(left, right) {
  const bySyntax = syntaxOf(left) - syntaxOf(right);
  if (bySyntax !== SAME) {
    return bySyntax;
  }
  return byName(left, right);
}

function declarationProblem(previous, current) {
  const was = syntaxOf(previous);
  const is = syntaxOf(current);
  if (is < was) {
    return [{ data: { current: SYNTAX[is], previous: SYNTAX[was] }, messageId: "syntaxOrder", node: current }];
  }
  if (is === was && byName(previous, current) === AFTER) {
    return [{ messageId: "declarationOrder", node: current }];
  }
  return [];
}

function gapsOf(text, nodes) {
  return Array.from(nodes.slice(NEXT), (node, index) =>
    String(text.slice(nodes[index].range[NEXT], node.range[FIRST])),
  );
}

function replacing(text, nodes, sorted) {
  const gaps = gapsOf(text, nodes);
  const pieces = sorted.map((node, index) => `${gaps[index - NEXT] ?? ""}${text.slice(...node.range)}`);
  const range = [nodes[FIRST].range[FIRST], nodes.at(BEFORE).range[NEXT]];
  return { fix: (fixer) => fixer.replaceTextRange(range, pieces.join("")) };
}

function declarationsFix(text, declarations) {
  if (!gapsOf(text, declarations).every((gap) => BETWEEN_DECLARATIONS.test(gap))) {
    return {};
  }
  return replacing(text, declarations, declarations.toSorted(byDeclarationOrder));
}

function membersFix(text, members) {
  if (!gapsOf(text, members).every((gap) => BETWEEN_MEMBERS.test(gap))) {
    return {};
  }
  return replacing(text, members, members.toSorted(byName));
}

function memberProblems(text, declaration) {
  const members = declaration.specifiers.filter((specifier) => specifier.type === "ImportSpecifier");
  const unsorted = members.findIndex(
    (member, index) => index > FIRST && byName(members[index - NEXT], member) === AFTER,
  );
  if (unsorted === BEFORE) {
    return [];
  }
  const node = members[unsorted];
  return [{ data: { member: nameOf(node) }, messageId: "memberOrder", node, ...membersFix(text, members) }];
}

export const sortImports = {
  create(context) {
    return {
      Program(program) {
        const { text } = context.sourceCode;
        const declarations = program.body.filter((node) => node.type === "ImportDeclaration");
        const problems = declarations
          .slice(NEXT)
          .flatMap((current, index) => declarationProblem(declarations[index], current));
        for (const problem of problems) {
          context.report({ ...problem, ...declarationsFix(text, declarations) });
        }
        for (const problem of declarations.flatMap((declaration) => memberProblems(text, declaration))) {
          context.report(problem);
        }
      },
    };
  },
  meta: {
    fixable: "code",
    messages: {
      declarationOrder: "Imports should be sorted alphabetically.",
      memberOrder: "Member '{{member}}' of the import declaration should be sorted alphabetically.",
      syntaxOrder: "Expected '{{current}}' syntax before '{{previous}}' syntax.",
    },
    schema: [],
    type: "suggestion",
  },
};
