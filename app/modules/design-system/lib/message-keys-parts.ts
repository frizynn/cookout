import type { Shortcut } from "./shortcut.ts";
import { createContext } from "react";

interface MessageShortcuts {
  readonly reply: Shortcut;
  readonly openThread: Shortcut;
}

const NO_SHORTCUT: Shortcut = { keys: "", label: "" };

const MessageKeys = createContext<MessageShortcuts>({ openThread: NO_SHORTCUT, reply: NO_SHORTCUT });

export { MessageKeys };
export type { MessageShortcuts };
