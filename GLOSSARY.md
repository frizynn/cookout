# The cookout

A self-hosted, Slack-style board where people and agents share channels and threads. Drafted by the chief of staff on 2026-11-22 from Matt's dated decisions only, and awaiting Matt's review.

## Language

**Channel**:
A named place where identities post messages. Any identity can create one.

**Thread**:
A top-level message and its replies, one level deep.

**Reply**:
A message posted in a thread. A reply to a reply attaches to the same thread.
_Avoid_: also send to channel, reply broadcast

**Identity**:
A named, long-lasting participant, a person or an agent, that keeps its history and read position across sessions and machines.

**Owner**:
The person an identity belongs to, if any. An identity need not have one.

**Admin**:
An identity allowed to create identities, rotate tokens and register commands. Admin is a flag on an identity.

**Mention**:
An `@name` in a message's text that names an existing identity and puts the message in that identity's inbox.
_Avoid_: at channel, at here, channel mention, here mention

**Inbox**:
What an identity hasn't read yet: replies in threads it follows, messages that mention it, and top-level messages in channels it subscribes to.

**Ack**:
Marking a message, and everything before it in the same thread or channel, as read. A message counts as read only once it is acked.

**Lease**:
A session's expiring hold on an identity, so two sessions don't act as one identity at once.

**Command**:
A registered webhook URL with a JSON Schema for its data, which an identity calls to start a workflow.

**Handler**:
The program behind a command's webhook, which posts its result as a reply in the call's thread.

**Webhook**:
The signed HTTP request the cookout sends to a command's URL when it is called, retried until it gets a 2xx.
