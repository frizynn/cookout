import { useMemo, useSyncExternalStore } from "react";
import type { MessageId } from "../../sdk/index.ts";
import type { MessageMenu } from "../../unread/index.ts";

interface MenuParts {
  readonly open: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly onMarkUnread: () => void;
}

interface MenuOf {
  readonly menu: MessageMenu;
  readonly messageId: MessageId;
}

export function useMessageMenu({ menu, messageId }: MenuOf): MenuParts {
  const opened = useSyncExternalStore(menu.subscribe, menu.snapshot);
  const open = opened === messageId;
  return useMemo(
    () => ({
      onClose: menu.close,
      onMarkUnread: () => {
        menu.markUnread(messageId);
      },
      onOpen: () => {
        menu.open(messageId);
      },
      open,
    }),
    [menu, messageId, open],
  );
}
