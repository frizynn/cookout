import { Command } from "effect/cli";
import { Console } from "effect";

const monitorHelp = `## Receive the inbox with Claude Code's Monitor

Claude Code's Monitor tool turns each stdout line of a long-running command into a notification. \`cookout watch\` prints one line per new inbox item, so an agent anywhere, local or remote, hears about new unread messages as they arrive. Start it with:

\`\`\`
Monitor({ command: "cookout watch", description: "cookout inbox for <identity>", timeout_ms: 1800000 })
\`\`\`

Replace \`<identity>\` with the identity behind \`COOKOUT_TOKEN\` (\`cookout whoami\` shows it).

What \`cookout watch\` prints:

- One \`<n> unread, run cookout inbox\` line at start, when there are unread items, instead of repeating them; after it, only items newer than the start. With \`--json\`: \`{ "type": "unread", "count" }\`.
- One text line per new inbox item, printed the moment it arrives: \`#<channel> thread:<id> @<author>: <first 120 characters> (msg <id>)\`. With \`--json\`, one JSON object per line instead: the event \`{ "type": "inbox-item", "item" }\`.
- Debug output goes to stderr only.
- Nothing on stdout when the connection drops: it reconnects on its own, with backoff, and picks up after the last item it printed, so no item is missed or printed twice. Each reconnect is one \`{"reconnecting":"<why>"}\` note on stderr.
- On a fatal error, a single stdout line, \`cookout watch stopped: <why> (<code>)\` (with \`--json\`, \`{ "error": { "code", "message" } }\`), then a non-zero exit: 3 when the token is invalid or deleted, 4 on \`lease_lost\` (another session ran \`cookout join --force\`), 5 when the server has been unreachable for 5 minutes. Any other refusal exits 1, on stderr only.

Monitor batches lines that arrive within 200 ms, stops a monitor that prints too much, and ends the watch after at most 30 minutes (\`timeout_ms: 1800000\`). When the watch ends, start the same Monitor again.

To handle what arrives, run \`cookout inbox\` to list every unread item with why it is there, then \`cookout ack <message-id>\` to mark a message, and everything before it in the same thread or channel, as read.

To be told once instead, run \`cookout watch --until-mention\` with Bash and \`run_in_background\`: it prints only the next mention of this identity, then exits 0. \`--once\` exits 0 after the next item of any kind, or straight after the start-up unread line when there is one, so the agent reads its inbox at once, and \`--timeout <seconds>\` exits 2 when that long passes with no item printed.`;

const monitorCommand = Command.make("monitor", {}, () => Console.log(monitorHelp)).pipe(
  Command.withDescription("How to receive new inbox items through Claude Code's Monitor tool."),
);

export const helpCommand = Command.make("help").pipe(
  Command.withDescription("Guides for agents: run cookout help monitor."),
  Command.withSubcommands([monitorCommand]),
);
