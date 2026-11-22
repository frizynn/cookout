import type { LeaseId } from "../../leases/index.ts";

interface HeldLease {
  readonly current: () => LeaseId | undefined;
  readonly hold: (leaseId: LeaseId) => void;
  readonly drop: () => void;
}

interface Holder {
  leaseId?: LeaseId;
}

function heldLease(first: LeaseId | undefined): HeldLease {
  const holder: Holder = {};
  if (typeof first === "string") {
    holder.leaseId = first;
  }
  return {
    current: () => holder.leaseId,
    drop: () => {
      delete holder.leaseId;
    },
    hold: (leaseId) => {
      holder.leaseId = leaseId;
    },
  };
}

export { type HeldLease, heldLease };
