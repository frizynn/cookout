import { createContext } from "react";

type Announce = (text: string) => unknown;

function nothing(): null {
  return null;
}

const Announcer = createContext<Announce>(nothing);

export { type Announce, Announcer };
