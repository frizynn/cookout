# Deactivation offers come from recorded activity, on the nudge scheduler

2026-11-24 (mattpocock/cookout#234, spec #232). A **Deactivation offer** asks an agent's owner whether to deactivate an agent that has had no **Activity** for 30 days (Matt approved both terms, and decided that Mark all as read clears an offer as Keep does, on #232, 2026-11-23).

## Decision

- **Last activity is recorded, not worked out from history.** Storage keeps one time per identity (both Layers, a migration, the contract suite). The Storage Layer's message, command call, reaction and presence writes each move it forward, so every route that posts, reacts or opens or closes a live connection counts without knowing about it. An identity's last activity is the latest of that time, its creation, and when the store began recording activity (SQLite fills `activity_since` on its first open after the migration), so identities that predate the release are quiet only from then. An identity that is Online is never due.
- **The offer is one stored entry shared by its recipients**: its ID, the agent, its recipients (the owner, or every active admin when the owner is Deactivated, fixed when it is raised), when it was raised, how many quiet days it reports and whether it was cleared. It is open only while it isn't cleared, the agent is active and offline, and the agent has had no activity since it was raised, so a post or a deactivation closes it in the same change that stores them.
- **When the next is due** is never stored: storage answers it from last activity and the agent's newest offer, 30 days after the later of the two. None is raised at 90 days, which automatic deactivation handles.
- **The nudge scheduler raises them** ([ADR "nudges are scheduled from storage"](0066-nudges-are-scheduled-from-storage.md)): its one fiber also asks storage for the next offer due, has storage raise every due offer and clear every stale one in one operation, and publishes each change as a `deactivation-offer` event to each recipient's streams. A post, a reaction, an identity change or a presence change wakes it, so an offer cleared by activity is announced at once.
- **The 30 and 90 days** are `quietAgentDays` in the inbox module, beside `nudgeIntervals` (#211 makes them settings).

## Considered options

- **Work last activity out from messages, reactions and presence on each look.** Rejected: each Layer would need its own query over three tables, and a reactivation (which restarts the clock) leaves no trace in them.
- **Record activity in each route.** Rejected: every new way to post or react would have to remember to.
