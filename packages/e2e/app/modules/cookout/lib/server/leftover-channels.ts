import { Layer, ManagedRuntime } from "effect";
import { deleteE2eChannels } from "./cookout-under-test.ts";

const bridge = ManagedRuntime.make(Layer.empty);

const hooks = { setup: (): Promise<void> => bridge.runPromise(deleteE2eChannels) };

const { setup } = hooks;

export { setup, setup as teardown };
