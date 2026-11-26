import type { Channel, SetChannelRoutingRequest, WakeHarness, WakeOptions } from "../../channels/index.ts";

type WakeMode = "session" | "ephemeral";

interface RoutingFields {
  readonly owner: string;
  readonly router: string;
  readonly fallback: string;
  readonly wake: WakeMode;
  readonly harness: string;
  readonly model: string;
  readonly effort: string;
}

interface HarnessAsked {
  readonly options: WakeOptions | null;
  readonly name: string;
}

interface WakeChange {
  readonly fields: RoutingFields;
  readonly options: WakeOptions | null;
}

const EMPTY: RoutingFields = {
  effort: "",
  fallback: "",
  harness: "",
  model: "",
  owner: "",
  router: "",
  wake: "session",
};

const FIELDS = ["owner", "router", "fallback"] as const;

function routingOf(found: Channel): Pick<RoutingFields, "fallback" | "owner" | "router"> {
  return { fallback: found.fallback ?? "", owner: found.owner ?? "", router: found.router ?? "" };
}

function fieldsOf(found: Channel | null): RoutingFields {
  if (found === null) {
    return EMPTY;
  }
  if (typeof found.fallbackWake !== "object") {
    return { ...EMPTY, ...routingOf(found) };
  }
  return { ...routingOf(found), ...found.fallbackWake, wake: "ephemeral" };
}

function fallbackWakeOf(fields: RoutingFields): Pick<SetChannelRoutingRequest, "fallbackWake"> {
  if (fields.wake === "session" || fields.fallback.trim() === "" || fields.harness === "") {
    return {};
  }
  return { fallbackWake: { effort: fields.effort, harness: fields.harness, model: fields.model } };
}

function requestOf(fields: RoutingFields): SetChannelRoutingRequest {
  const filled = FIELDS.filter((field) => fields[field].trim() !== "");
  return { ...Object.fromEntries(filled.map((field) => [field, fields[field].trim()])), ...fallbackWakeOf(fields) };
}

function harnessIn({ name, options }: HarnessAsked): WakeHarness | null {
  if (options === null) {
    return null;
  }
  return options.harnesses.find((harness) => harness.name === name) ?? null;
}

function keptOr(offered: readonly string[], current: string): string {
  const [first = ""] = offered;
  if (offered.includes(current)) {
    return current;
  }
  return first;
}

function withHarness({ fields, options }: WakeChange, name: string): RoutingFields {
  const harness = harnessIn({ name, options });
  if (harness === null) {
    return fields;
  }
  const models = harness.models.map((model) => model.name);
  return {
    ...fields,
    effort: keptOr(harness.efforts, fields.effort),
    harness: harness.name,
    model: keptOr(models, fields.model),
  };
}

function firstHarness(options: WakeOptions | null): WakeHarness | null {
  if (options === null) {
    return null;
  }
  const [first = null] = options.harnesses;
  return first;
}

function withWake(change: WakeChange, wake: WakeMode): RoutingFields {
  const fields = { ...change.fields, wake };
  const { options } = change;
  const first = firstHarness(options);
  if (wake === "session" || first === null || harnessIn({ name: fields.harness, options }) !== null) {
    return fields;
  }
  return withHarness({ fields, options }, first.name);
}

function editedHarness(change: WakeChange): (name: string) => RoutingFields {
  return (name) => withHarness(change, name);
}

function editedWake(change: WakeChange): (wake: WakeMode) => RoutingFields {
  return (wake) => withWake(change, wake);
}

export { EMPTY, type RoutingFields, type WakeMode, editedHarness, editedWake, fieldsOf, harnessIn, requestOf };
