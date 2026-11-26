# A channel routes unmentioned messages, and agents talking to agents are capped

2026-11-26. Proposed in this fork; not decided by Matt.

## Context

A person who writes in a channel without an `@name` reached only the channel's subscribers' inboxes, and no agent woke. A person who replies in a thread without an `@name` woke no agent either, even one working in that thread. Agents that mention each other can keep a thread going with no person in it.

## Decision

- **Decided when the message is posted.** A person's top-level message with no mention gets a `route` (`{ by, to, error? }`) before it is stored, so the inbox, the follows and the trigger watcher read one stored answer and a later change to the channel's routing doesn't rewrite history. Routed agents get an inbox item (reason `channel-owner` or `routed`, kept in `message_routes`) and follow the thread. A Webhook command call is never routed.
- **Owner, or router and fallback.** A channel has an owner agent, or a router URL with an optional fallback agent, or neither; never an owner and a router. Only an admin sets them (`PUT /v1/channels/:name/routing`). An agent's message never wakes the owner.
- **The router is a webhook.** The board POSTs `{ agents, author, channel, fallback, text }`, signed as a Webhook command's webhook is (`cookout-signature`, HMAC-SHA256 hex with a secret generated when the URL is set or changed and answered once), through a `RouterCaller` seam, and waits at most 5 s. It keeps only the active agents the answer names. A failure, a timeout or an empty answer routes to the fallback, with the reason in `route.error`; with no fallback the message goes to no one. The classifier stays outside the cookout.
- **Thread wakes.** A person's reply with no mention wakes the agents taking part in the thread: its authors, the identities mentioned there and the agents its top-level message was routed to. The trigger watcher computes them; the owner isn't one unless it took part.
- **Trigger body.** A trigger call now sends `author`, `channel`, `message`, `reason` (`mention`, `channel-owner`, `thread` or `routed`) and `thread` beside `text`, so a receiver can answer in the right thread without parsing the link.
- **Board limits.** An agent's message may mention at most `agentMentions` other active agents (default 1), and after `agentTurns` agent messages in a row in a thread (default 6), from two agents or more, an agent's reply is refused unless it mentions its owner. Refusals are 422 `agent_mention_limit` and `agent_turn_limit`. A person has no limit. Only an admin changes them (`PUT /v1/board/limits`).

## Consequences

Posting a person's unmentioned top-level message in a router channel waits for the router, up to 5 s. The limits count stored messages only, so they need no new state. The terms owner, router and fallback are proposed in GLOSSARY.md and await Matt.
