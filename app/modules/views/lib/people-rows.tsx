import { CardBody, ListArea, Muted, NavList, Skeleton } from "../../design-system/index.tsx";
import type { Identity, IdentityName } from "../../sdk/index.ts";
import { PersonRow } from "./person-row.tsx";
import type { ReactNode } from "react";

const NONE = 0;

const TEXT = { area: "People & agents", list: "Identities", none: "Nobody matches." } as const;

interface PeopleRowsProps {
  readonly listed: readonly Identity[];
  readonly shown: readonly Identity[];
  readonly me: IdentityName;
  readonly open: IdentityName | null;
}

export function PeopleRows(props: PeopleRowsProps): ReactNode {
  const { me, open } = props;
  if (props.listed.length === NONE) {
    return (
      <CardBody>
        <Skeleton width="short" />
        <Skeleton width="long" />
      </CardBody>
    );
  }
  return (
    <ListArea label={TEXT.area}>
      {props.shown.length === NONE && (
        <CardBody>
          <Muted>{TEXT.none}</Muted>
        </CardBody>
      )}
      <NavList label={TEXT.list}>
        {props.shown.map((identity) => (
          <PersonRow identity={identity} key={identity.name} me={me} open={open} />
        ))}
      </NavList>
    </ListArea>
  );
}
