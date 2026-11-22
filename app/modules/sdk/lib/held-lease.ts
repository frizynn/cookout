import type { LeaseId } from "../../leases/index.ts";

interface HeldLease {
  readonly current: () => LeaseId | undefined;
  readonly hold: (leaseId: LeaseId) => void;
  readonly drop: () => void;
}

function heldLease(first: LeaseId | undefined): HeldLease {
  const held = new Set<LeaseId>();
  if (typeof first === "string") {
    held.add(first);
  }
  return {
    current: () => held.values().next().value,
    drop: () => {
      held.clear();
    },
    hold: (leaseId) => {
      held.clear();
      held.add(leaseId);
    },
  };
}

export { type HeldLease, heldLease };
