import { pageTitleOwner } from "../rules/page-title-owner.js";
import { ruleTester } from "./rule-tester.js";

const errors = [{ messageId: "title" }];

ruleTester.run("page-title-owner", pageTitleOwner, {
  invalid: [
    { code: 'document.title = "Inbox";', errors },
    { code: 'globalThis.document.title = "Inbox";', errors },
    { code: 'window.document["title"] = "Inbox";', errors },
    { code: 'document.title += " · cookout";', errors },
  ],
  valid: [
    { code: "const title = document.title;" },
    { code: 'page.title = "Inbox";' },
    { code: 'document.body.title = "Inbox";' },
  ],
});
