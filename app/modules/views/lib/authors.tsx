import { AuthorList } from "./author-list.ts";
import type { Identities } from "../../composer/index.ts";
import type { ReactNode } from "react";

interface AuthorsProps {
  readonly identities: Identities;
  readonly children: ReactNode;
}

export function Authors(props: AuthorsProps): ReactNode {
  return <AuthorList value={props.identities}>{props.children}</AuthorList>;
}
