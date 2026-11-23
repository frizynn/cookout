# Example handler

A tiny handler for a cookout command, and the reference for writing your own. It imports only `@ai-hero/cookout/sdk`.

Run it with `COOKOUT_COMMAND_SECRET=<the command's secret> PORT=8787 node app/main.ts`.

## Endpoints

- `GET /health` answers `200`.
- `POST /webhook` takes a command call from the cookout. The body is JSON: `{ command, data, threadId, token, callId }`. A signed call answers `202`; a signed body that is not a command call answers `400`; a bad or missing signature answers `401`, and the call goes no further.

## Checking the signature

Every webhook the cookout sends is signed with the command's HMAC secret, so a handler can check the request came from the cookout:

1. Read the raw request body as bytes, before parsing it. Parsing and serialising it again can change the bytes.
2. Compute HMAC-SHA256 of those bytes, keyed with the command's secret (its UTF-8 bytes).
3. Hex-encode the result in lowercase: 64 characters, with no prefix such as `sha256=`.
4. Compare it with the `cookout-signature` header in constant time. If the header is missing or doesn't match, answer `401` and do nothing else.

In Node:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

const expected = createHmac("sha256", secret).update(rawBody).digest();
const header = request.headers["cookout-signature"];
const signed =
  typeof header === "string" &&
  /^[0-9a-f]{64}$/u.test(header) &&
  timingSafeEqual(Buffer.from(header, "hex"), expected);
```

The cookout retries a call that gets no `2xx` with the same `callId`, so drop a `callId` you have already handled.
