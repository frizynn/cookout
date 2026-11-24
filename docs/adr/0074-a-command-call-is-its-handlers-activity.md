# A call to a command is its handler's Activity (an assumption pending Matt)

2026-11-24 (mattpocock/cookout#236). This is an assumption made to build #236, not Matt's decision: the question is open with him on the board, and this ADR changes if he decides otherwise.

A command's handler is an agent. Activity (`GLOSSARY.md`) is posting, reacting or being Online, so a webhook handler that answers its calls through its command token, and never connects, would look quiet: after 30 days its owner would be offered to deactivate it, and after 90 days the cookout would deactivate it while people still call it. We assume instead that a call to one of its commands is Activity for the handler, at the call's time.

## Consequences

- **One place.** The storage wrapper that records Activity (`app/modules/storage/lib/server/activity.ts`) records the handler as well as the caller when a command call is appended, so Deactivation offers and the 90-day deactivation both see it. Reversing the assumption is deleting that one record.
- **Only handlers nobody calls go quiet.** A handler called at least once every 30 days never gets an offer.

## Considered options

- **Only the handler's own posts, reactions and presence count.** Rejected for now: it deactivates working webhook handlers. It is what Matt may still choose.

2026-11-24: Matt approved this rule; it is no longer an assumption.
