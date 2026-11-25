import type { ExternalStore, HandLive, Publishes } from "../../testing/web.ts";
import { expect, it, onTestFinished, vi } from "vitest";
import { handLive, recordPublishes } from "../../testing/web.ts";
import type { Composer } from "../../composer/index.ts";
import type { IdentityName } from "../../sdk/index.ts";
import { adminClient } from "./identities.ts";
import { boardStoreFor } from "./defaults.ts";
import { createComposer } from "../../composer/index.ts";
import { createLive } from "../../live/index.ts";
import { waitFor } from "@testing-library/react";

const NONE = 0;
const CARET = 1;

interface Composing {
  readonly composer: Composer;
  readonly hand: HandLive;
  readonly admin: IdentityName;
}

function storesOf({ admin, composer }: Composing): readonly ExternalStore<unknown>[] {
  const actions = composer.identities.actions(admin);
  return [
    composer.channelDraft("general"),
    composer.draft("general/1"),
    composer.identities,
    actions,
    { snapshot: actions.snapshot, subscribe: actions.subscribeToSessions },
    { snapshot: actions.snapshot, subscribe: actions.subscribeToMessages },
    composer.identities.creation,
    composer.identities.deletion,
    composer.displayName(admin),
    composer.description(admin),
    composer.trigger(admin),
  ];
}

async function composing(): Promise<Composing> {
  const { identity } = await adminClient().whoami();
  const hand = handLive();
  const composer = createComposer({
    boardStore: boardStoreFor({ client: adminClient(), live: createLive(hand.adapter) }),
  });
  return { admin: identity.name, composer, hand };
}

async function recordedOnceLoaded(
  stores: readonly ExternalStore<unknown>[],
  composer: Composer,
): Promise<readonly Publishes[]> {
  for (const store of stores) {
    onTestFinished(store.subscribe(vi.fn<() => void>()));
  }
  await waitFor(() => {
    expect(composer.identities.snapshot()).not.toHaveLength(NONE);
  });
  return stores.map((store) => recordPublishes(store));
}

it("someone coming online publishes nothing from the composer's stores", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const opened = await composing();
  const publishes = await recordedOnceLoaded(storesOf(opened), opened.composer);

  opened.hand.send({ presence: { identity: opened.admin, online: true }, type: "presence" });
  opened.hand.send({ presence: { identity: opened.admin, online: false }, type: "presence" });

  expect(publishes.map((store) => store.count())).toStrictEqual(publishes.map(() => NONE));
});

it("a draft publishes nothing when dismissed again, or moving a highlight it has none to move", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const { composer } = await composing();
  const draft = composer.draft("web-composer-publishes/1");
  onTestFinished(draft.subscribe(vi.fn<() => void>()));
  draft.edit("Lunch?", CARET);
  draft.dismiss();
  const publishes = recordPublishes(draft);

  draft.dismiss();
  draft.highlight("down");

  expect(publishes.count()).toBe(NONE);
});

it("the profile's stores publish nothing for an edit that changes nothing", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { admin, composer } = await composing();
  const actions = composer.identities.actions(admin);
  const stores = [actions, composer.identities.creation, composer.identities.deletion, composer.trigger(admin)];
  const publishes = await recordedOnceLoaded(stores, composer);

  actions.cancel();
  actions.forgetToken();
  composer.identities.deletion.dismiss();
  composer.identities.creation.edit("");

  expect(publishes.map((store) => store.count())).toStrictEqual(publishes.map(() => NONE));
});
