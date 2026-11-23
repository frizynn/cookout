import type { JoinRequest, LeaseResponse, LeaveResponse } from "../../leases/index.ts";
import { isLeaseResponse, isLeaveResponse } from "./generated/validators.js";
import type { ClientConnection } from "./request.ts";
import { leasePath } from "../../leases/index.ts";
import { send } from "./request.ts";

interface LeaseCalls {
  readonly join: (request: JoinRequest) => Promise<LeaseResponse>;
  readonly leave: () => Promise<LeaveResponse>;
}

function leaseCalls(server: ClientConnection): LeaseCalls {
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
