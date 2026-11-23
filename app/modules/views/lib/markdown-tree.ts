import { mentionPattern } from "../../messages/index.ts";

const AT_SIGN = 1;
const BLOCK_PARENTS = new Set(["blockquote", "footnoteDefinition", "listItem", "root"]);
const PLAIN_TEXT_LANGUAGES = new Set(["text", "txt"]);
const START = 0;

interface MarkdownNode {
  readonly type: string;
  readonly value?: string;
  readonly lang?: string | null;
  readonly children?: readonly MarkdownNode[];
  readonly data?: {
    readonly hName: string;
    readonly hProperties: Readonly<Record<string, string>>;
  };
}

interface MentionsShown {
  readonly mentions: readonly string[];
  readonly me: string;
}

function textNode(value: string): MarkdownNode {
  return { type: "text", value };
}

function whoseMention(name: string, shown: MentionsShown): string {
  if (name === shown.me) {
    return "mine";
  }
  return "other";
}

function mentionNode(name: string, shown: MentionsShown): MarkdownNode {
  return {
    children: [textNode(`@${name}`)],
    data: { hName: "span", hProperties: { dataMention: whoseMention(name, shown) } },
    type: "mention",
  };
}

function splitMentions(text: string, shown: MentionsShown): readonly MarkdownNode[] {
  const pieces: MarkdownNode[] = [];
  let kept = START;
  for (const found of text.matchAll(mentionPattern)) {
    const [name] = found;
    if (shown.mentions.includes(name)) {
      const at = found.index - AT_SIGN;
      pieces.push(textNode(text.slice(kept, at)), mentionNode(name, shown));
      kept = found.index + name.length;
    }
  }
  pieces.push(textNode(text.slice(kept)));
  return pieces.filter((piece) => piece.type !== "text" || piece.value !== "");
}

function htmlAsText(html: string, parent: string): MarkdownNode {
  const text = textNode(html);
  if (BLOCK_PARENTS.has(parent)) {
    return { children: [text], type: "paragraph" };
  }
  return text;
}

function isPlainText(lang: string | null | undefined): boolean {
  if (typeof lang !== "string") {
    return true;
  }
  return PLAIN_TEXT_LANGUAGES.has(lang.toLowerCase());
}

function codeNode(node: MarkdownNode): MarkdownNode {
  if (!isPlainText(node.lang)) {
    return node;
  }
  return { ...node, data: { hName: "code", hProperties: { dataWrap: "" } } };
}

type ShowChild = (child: MarkdownNode, parent: string) => readonly MarkdownNode[];

function withShownChildren(node: MarkdownNode, show: ShowChild): MarkdownNode {
  if (!("children" in node)) {
    return node;
  }
  const { children = [] } = node;
  return { ...node, children: children.flatMap((child) => show(child, node.type)) };
}

function shownNode(node: MarkdownNode, parent: string, shown: MentionsShown): readonly MarkdownNode[] {
  if (typeof node.value !== "string") {
    return [withShownChildren(node, (child, under) => shownNode(child, under, shown))];
  }
  if (node.type === "html") {
    return [htmlAsText(node.value, parent)];
  }
  if (node.type === "text") {
    return splitMentions(node.value, shown);
  }
  if (node.type === "code") {
    return [codeNode(node)];
  }
  return [node];
}

export function remarkMessageText(shown: MentionsShown): (tree: MarkdownNode) => MarkdownNode {
  return (tree) => {
    const [root = tree] = shownNode(tree, "", shown);
    return root;
  };
}
