---
"@ai-hero/cookout": minor
---

A join request never creates an agent. `cookout join --as <name>` with no Login (and `POST /v1/agent-join-requests`, the SDK's `startAgentJoin`) is refused at once with 404 `agent_not_found` when no active agent has that name, and no request is stored. Approving (`cookout approve-join`, the approval page) joins an existing agent only, so a request's `creates` is always `false`; an agent creates the worker first with `cookout identity create` (`createAgentForOwner`). A human's `join --as` with a Login still creates their own agent.
