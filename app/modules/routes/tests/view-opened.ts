import type { Answering, ClientMethod } from "./answering.ts";
import type { CookoutClient } from "../../sdk/index.ts";
import { answering } from "./answering.ts";
import { openAt } from "./render.tsx";

interface ViewOpening {
  readonly client: CookoutClient;
  readonly hash: string;
  readonly waitingOn: readonly ClientMethod[];
}

interface OpenedView {
  readonly answered: Answering["answered"];
  readonly close: () => void;
}

async function viewOpened({ client, hash, waitingOn }: ViewOpening): Promise<OpenedView> {
  const { answered, client: answeringClient } = answering(client);
  const close = openAt({ client: answeringClient, hash });
  await Promise.all(
    waitingOn.map(async (method) => {
      await answered(method);
    }),
  );
  return { answered, close };
}

interface ProfileOpening {
  readonly client: CookoutClient;
  readonly name: string;
  readonly waitingOn?: readonly ClientMethod[];
}

const PROFILE_CALLS: readonly ClientMethod[] = ["listIdentities", "countMessagesBy"];

async function profileOpened({ client, name, waitingOn = PROFILE_CALLS }: ProfileOpening): Promise<OpenedView> {
  const opened = await viewOpened({ client, hash: `#/people/${name}`, waitingOn });
  return opened;
}

export { type OpenedView, profileOpened, viewOpened };
