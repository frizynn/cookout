import { Alert } from "../../design-system/index.tsx";
import type { ChannelName } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import type { SubscriptionsState } from "../../board/index.ts";

interface SubscriptionRefusalProps {
  readonly channel: ChannelName;
  readonly state: SubscriptionsState;
}

export function SubscriptionRefusal(props: SubscriptionRefusalProps): ReactNode {
  const { state } = props;
  if (state.status === "failed") {
    return <Alert>{`Couldn't load your subscriptions (${state.code}): ${state.message}`}</Alert>;
  }
  if (state.status === "loaded" && state.change.status === "failed" && state.change.channel === props.channel) {
    return <Alert>{`Couldn't change the subscription (${state.change.code}): ${state.change.message}`}</Alert>;
  }
  return null;
}
