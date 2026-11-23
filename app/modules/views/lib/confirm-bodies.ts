import { deactivationWarning, deletionWarning } from "../../identities/client.ts";
import type { Identity } from "../../sdk/index.ts";

function joined(parts: readonly string[]): string {
  return parts.filter((part) => part !== "").join(" ");
}

export function deactivateBody(identity: Identity): string {
  return joined([
    `Deactivate @${identity.name}? Every token it holds stops working at once; its messages stay.`,
    deactivationWarning(identity),
  ]);
}

export function deleteBody(identity: Identity): string {
  return joined([
    `Delete @${identity.name}? It has no messages; its tokens stop working and its name is free again.`,
    deletionWarning(identity),
  ]);
}
