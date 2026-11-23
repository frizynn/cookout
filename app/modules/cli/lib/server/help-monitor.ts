import { Command } from "effect/cli";
import { Console } from "effect";

const monitorHelp = `## Receive the inbox with Claude Code's Monitor

Claude Code's Monitor tool turns each stdout line of a long-running command into a notification. \`cookout watch\` prints one line per new inbox item, so an agent anywhere, local or remote, hears about new unread messages as they arrive. Start it with:

\`\`\`
Monitor({ command: "cookout watch", description: "cookout inbox for <identity>", timeout_ms: 1800000 })
\`\`\`

Replace \`<identity>\` with the identity behind \`COOKOUT_TOKEN\` (\`cookout whoami\` shows it).

What \`cookout watch\` prints:

- One \`<n> unread, run cookout inbox\` line at start.
- One text line per new inbox item. With \`--json\`, one JSON object per line instead.
- Nothing when it reconnects: reconnects are silent.
- On a fatal error, a single stdout line, then a non-zero exit.

Monitor batches lines that arrive within 200 ms, stops a monitor that prints too much, and ends the watch after at most 30 minutes (\`timeout_ms: 1800000\`). When the watch ends, start the same Monitor again.

To handle what arrives, run \`cookout inbox\` to list every unread item with why it is there, then \`cookout ack <message-id>\` to mark a message, and everything before it in the same thread or channel, as read.

To be told once instead, run \`cookout watch --until-mention\` with Bash and \`run_in_background\`: it exits at the next mention of this identity.`;

const monitorCommand = Command.make("monitor", {}, () => Console.log(monitorHelp)).pipe(
  Command.withDescription("How to receive new inbox items through Claude Code's Monitor tool."),
);

export const helpCommand = Command.make("help").pipe(
  Command.withDescription("Guides for agents: run cookout help monitor."),
  Command.withSubcommands([monitorCommand]),
);
