import type { Identity } from "../../sdk/index.ts";

export function kindOf(identity: Identity): string {
  if (identity.kind === "human") {
    return "Human";
  }
  if ("owner" in identity) {
    return `Agent · owned by ${identity.owner}`;
  }
  return "Agent";
}
