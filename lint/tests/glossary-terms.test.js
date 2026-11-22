import rule from "../rules/glossary-terms.js";
import { ruleTester } from "./rule-tester.js";

const options = [{ glossary: "GLOSSARY.md" }];

ruleTester.run("glossary-terms", rule, {
  invalid: [
    {
      code: "const alsoSendToChannel = 1;",
      errors: [{ data: { name: "alsoSendToChannel", term: "also send to channel" }, messageId: "avoided" }],
      options,
    },
    {
      code: "type ReplyBroadcast = string;",
      errors: [{ data: { name: "ReplyBroadcast", term: "reply broadcast" }, messageId: "avoided" }],
      options,
    },
    {
      code: "const at_here_mention = 1;",
      errors: [{ data: { name: "at_here_mention", term: "at here" }, messageId: "avoided" }],
      options,
    },
  ],
  valid: [
    { code: "const sendToChannel = 1;", options },
    { code: "const replyCount = 1;", options },
    { code: "const ChannelReply = 1;", options },
  ],
});
