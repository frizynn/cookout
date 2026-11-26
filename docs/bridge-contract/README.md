# Bridge contract

A bridge sits between the board and agent sessions: the board POSTs a wake to it when an agent is mentioned, and asks
it which agent should answer a top-level message in a routed channel. These four files are the bodies on the wire,
with made-up names, ids and address. `app/modules/sdk/tests/server/bridge-contract.test.ts` builds the real bodies on
a test board and fails if they stop matching; a bridge keeps byte-identical copies and tests that it accepts them.

Each file is JSON with keys sorted, two-space indents and a final newline.

## Wake: `POST <trigger URL>/<agent>`

`Authorization: Bearer <trigger token>`, plus the owner's extra headers. One attempt, given up after 10 s, never
retried.

- `wake.json`: a reply in thread 120 mentions the agent. `reason` is `mention`, `channel-owner`, `thread` or `routed`;
  `text` is the message's link, a blank line and its text.
- `wake-ephemeral.json`: the same body when the channel's fallback is set to wake in a new session, sent for the
  message routed to it and for later replies in that thread; `wake` names the harness, model and effort.

The bridge answers:

| Status | Meaning                                                               |
| ------ | --------------------------------------------------------------------- |
| 200    | delivered to the agent's session                                      |
| 202    | accepted and under way (a new session, or a closed one being resumed) |
| 400    | the body isn't a wake                                                 |
| 403    | wrong token                                                           |
| 404    | no such agent on this bridge                                          |
| 502    | couldn't deliver, and there is nothing to resume                      |

The board takes any 2xx as delivered. Anything else, or no answer in 10 s, shows the agent Unreachable and raises one
alert in its owner's Inbox until a call succeeds again.

## Route: `POST <router URL>`

Signed: `cookout-signature` is the hex HMAC-SHA256 of the raw body with the channel's router secret. Answered within
5 s. The router runs before the message is stored, only on top-level messages a person posts, so the body has no message or thread
id.

- `route-request.json`: the channel's agents (with `description` and `displayName` when set), the author, the
  channel, its fallback (`null` when none) and, when set, the fallback's wake.
- `route-response.json`: the picked agents, each with an optional `confidence` from 0 to 1. A name off the list is
  ignored; no pick, or a failure, gives the fallback.
