import type { Fails, Hub } from "./acks.ts";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import type { ChannelName } from "../../../channels/index.ts";
import { Effect } from "effect";
import type { StorageUnavailable } from "../../../storage/server.ts";
import type { SubscriptionResponse } from "../../index.ts";
import { channelNotFound } from "../../../channels/server.ts";
import { isChannelName } from "../../../channels/index.ts";

type SubscriptionChange = (identity: IdentityName, channel: ChannelName) => Effect.Effect<boolean, StorageUnavailable>;

interface SubscriptionChanged {
  readonly identity: IdentityName;
  readonly subscription: SubscriptionResponse;
}

interface SubscriptionChanging {
  readonly change: SubscriptionChange;
  readonly subscribed: boolean;
  readonly hub: Hub<SubscriptionChanged>;
}

function subscription({
  change,
  hub,
  subscribed,
}: SubscriptionChanging): (caller: Identity, channel: string) => Fails<SubscriptionResponse> {
  return (caller: Identity, channel: string): Fails<SubscriptionResponse> =>
    Effect.gen(function* changeSubscription() {
      if (!isChannelName(channel)) {
        return yield* Effect.fail(channelNotFound(channel));
      }
      const exists = yield* change(caller.name, channel);
      if (!exists) {
        return yield* Effect.fail(channelNotFound(channel));
      }
      const answer = { channel, subscribed };
      yield* hub.publish({ identity: caller.name, subscription: answer });
      return answer;
    });
}

export { type SubscriptionChanged, subscription };
