import type { Channel, ChannelName } from "../../sdk/index.ts";
import { Button } from "../../design-system/controls.tsx";
import { ChannelSettingsDialog } from "./channel-settings-dialog.tsx";
import type { Identities } from "../../composer/index.ts";
import type { ReactNode } from "react";
import { SubscriptionToggle } from "./subscription-toggle.tsx";
import type { SubscriptionsState } from "../../board/index.ts";
import { isAdmin } from "./is-admin.ts";
import { useChannelSettings } from "./use-channel-settings.ts";
import { useSyncExternalStore } from "react";

const TEXT = { settings: "Settings" } as const;

interface ChannelHeaderToolsProps {
  readonly channel: ChannelName;
  readonly found: Channel | null;
  readonly identities: Identities;
  readonly me: string;
  readonly subscribed: SubscriptionsState;
}

export function ChannelHeaderTools(props: ChannelHeaderToolsProps): ReactNode {
  const { channel, found, identities, subscribed } = props;
  const listed = useSyncExternalStore(identities.subscribe, identities.snapshot);
  const settings = useChannelSettings({ channel, found });
  const admin = isAdmin({ identities: listed, me: props.me });
  const handleOpen = settings.show;
  return (
    <span className="flex items-center gap-2">
      {admin && (
        <Button icon="settings" onClick={handleOpen}>
          <span className="max-md:sr-only">{TEXT.settings}</span>
        </Button>
      )}
      {subscribed.status === "loaded" && <SubscriptionToggle channel={channel} state={subscribed} />}
      {admin && <ChannelSettingsDialog channel={channel} identities={listed} settings={settings} />}
    </span>
  );
}
