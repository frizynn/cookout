import type { JoinRequest, LeaseResponse, LeaveResponse } from "../../leases/index.ts";
import { isLeaseResponse, isLeaveResponse } from "./generated/validators.js";
import type { HeldLease } from "./held-lease.ts";
import { leasePath } from "../../leases/index.ts";
import { send } from "./request.ts";

interface Server {
  readonly url: string;
  readonly token?: string;
  readonly lease: HeldLease;
}

interface LeaseCalls {
  readonly join: (request: JoinRequest) => Promise<LeaseResponse>;
  readonly leave: () => Promise<LeaveResponse>;
}

function leaseCalls(server: Server): LeaseCalls {
  return {
    join: async (body) => {
      const lease = await send(server, { body, isExpected: isLeaseResponse, method: "POST", path: leasePath });
      server.lease.hold(lease.leaseId);
      return lease;
    },
    leave: async () => {
      const left = await send(server, { isExpected: isLeaveResponse, method: "DELETE", path: leasePath });
      server.lease.drop();
      return left;
    },
  };
}

export { leaseCalls };
