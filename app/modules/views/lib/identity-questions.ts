import type { IdentityAction, IdentityActions } from "../../composer/index.ts";
import type { IdentityName } from "../../sdk/index.ts";

interface Question {
  readonly title: string;
  readonly body: string;
  readonly confirm: string;
  readonly destructive: boolean;
}

type State = ReturnType<IdentityActions["snapshot"]>;

const NONE: Question = { body: "", confirm: "", destructive: false, title: "" };

const VERBS: Readonly<Record<IdentityAction, string>> = {
  deactivate: "deactivate",
  delete: "delete",
  reactivate: "reactivate",
  revoke: "revoke the session",
  rotate: "rotate the token",
  transfer: "transfer",
};

const QUESTIONS: Readonly<Record<IdentityAction, (name: string, to: string) => Question>> = {
  deactivate: (name) => ({
    body: "Its tokens and sessions stop working at once and it can't post; its messages stay. You can reactivate it later.",
    confirm: `Deactivate @${name}`,
    destructive: false,
    title: `Deactivate @${name}?`,
  }),
  delete: (name) => ({
    body: "It has no messages. Its tokens stop working and its name is free again. This can't be undone.",
    confirm: `Delete @${name}`,
    destructive: true,
    title: `Delete @${name}?`,
  }),
  reactivate: (name) => ({
    body: "It can post again with a new identity token, shown once here. Its old tokens stay revoked.",
    confirm: `Reactivate @${name}`,
    destructive: false,
    title: `Reactivate @${name}?`,
  }),
  revoke: (name) => ({
    body: "Its live agent session ends at once and can't be used again; it must join again to post.",
    confirm: "Revoke session",
    destructive: true,
    title: `Revoke @${name}'s session?`,
  }),
  rotate: (name) => ({
    body: "Its identity token stops working at once and can't be brought back. The new one is shown once here.",
    confirm: "Rotate token",
    destructive: true,
    title: `Rotate @${name}'s token?`,
  }),
  transfer: (name, to) => ({
    body: `@${to} owns it from now on and can rotate, revoke or deactivate it. An admin can transfer it again.`,
    confirm: `Transfer to @${to}`,
    destructive: false,
    title: `Transfer @${name} to @${to}?`,
  }),
};

interface Asked {
  readonly state: State;
  readonly name: IdentityName;
}

function questionOf({ name, state }: Asked): Question {
  if (state.confirming === null) {
    return NONE;
  }
  return QUESTIONS[state.confirming](name, state.transferTo.trim());
}

function refusalOf(state: State): string | null {
  const { action } = state;
  if (action.status !== "failed") {
    return null;
  }
  return `Couldn't ${VERBS[action.action]} (${action.code}): ${action.message}`;
}

export { questionOf, refusalOf };
