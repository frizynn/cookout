# Per-identity limits are in-memory token buckets, keyed by identity

2026-11-23 (mattpocock/cookout#92). Proposed, pending Matt.

Any identity's token, including a leaked agent token, could post, call commands and open `/v1/events` streams without limit, and each command call fans out to up to six signed webhook posts (mattpocock/cookout#92, from the 2026-11-23 security review). So the server keeps three limits per identity, in memory and timed by the Effect clock: a token bucket of `COOKOUT_REQUESTS_PER_MINUTE` (default 6000) that every request past the token gate takes from; a second bucket of `COOKOUT_COMMAND_CALLS_PER_MINUTE` (default 60) for command calls; and at most `COOKOUT_STREAMS_PER_IDENTITY` (default 20) open event streams. A bucket holds a full minute's worth, so a burst is fine and only a sustained flood is refused. Over a limit the answer is 429 with `rate_limited` (and `details.retryAfterSeconds`) or `too_many_streams`. The defaults sit far above any session, the test suites, the e2e suite or `pnpm dev`; tests lower them through the settings. The admin is limited like any identity. Pending Matt: the defaults, and the decisions below that the chief of staff took on 2026-11-23 under Matt's instruction to choose the best answer and record it.

## Considered options

- Limits in storage, so they hold across restarts and machines: rejected. The cookout runs on one machine, a restart resets them at no real cost, and a storage write on every request would add the load the limits are meant to stop.
- Limiting by IP address: rejected. Every request carries a token, the abuse in the review comes from a token, and behind Fly's proxy the IP address is a header anyone can forge.

## Consequences

- Webhook delivery no longer follows redirects. A 3xx counts as a failed attempt, so the command token and the signature never reach a server other than the command's URL, as the SDK already ensures for its own requests.
- The example handler refuses a body over 2 MiB with 413 before reading it whole or checking its signature: twice the cookout's 1 MiB cap on a call, so a real delivery always fits.
- _Assumption:_ `http:` handler URLs stay allowed for local development, and replay protection for signed deliveries (a signed timestamp) is left for after v1.
