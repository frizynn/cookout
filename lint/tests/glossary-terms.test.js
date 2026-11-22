import rule from "../rules/glossary-terms.js";
import { ruleTester } from "./rule-tester.js";

const options = [{ glossary: "GLOSSARY.md" }];

ruleTester.run("glossary-terms", rule, {
  valid: [
    { code: "const sendToChannel = 1;", options },
    { code: "const replyCount = 1;", options },
    { code: "const ChannelReply = 1;", options },
  ],
  invalid: [
    {
      code: "const alsoSendToChannel = 1;",
      options,
      errors: [{ messageId: "avoided", data: { name: "alsoSendToChannel", term: "also send to channel" } }],
    },
    {
      code: "type ReplyBroadcast = string;",
      options,
      errors: [{ messageId: "avoided", data: { name: "ReplyBroadcast", term: "reply broadcast" } }],
    },
    {
      code: "const at_here_mention = 1;",
      options,
      errors: [{ messageId: "avoided", data: { name: "at_here_mention", term: "at here" } }],
    },
  ],
});
