import { regionLookups as rule } from "../rules/region-lookups.js";
import { ruleTester } from "./rule-tester.js";

const pages = [{ pages: ["screen", "page", "other"] }];

ruleTester.run("region-lookups", rule, {
  invalid: [
    { code: 'screen.getByRole("button", { name: "Send" });', errors: [{ messageId: "pageWide" }], options: pages },
    {
      code: 'await screen.findByRole("link", { name: "#general" });',
      errors: [{ messageId: "pageWide" }],
      options: pages,
    },
    { code: 'screen.queryByRole("alert");', errors: [{ messageId: "pageWide" }], options: pages },
    { code: 'screen.queryAllByRole("alert");', errors: [{ messageId: "pageWide" }], options: pages },
    { code: 'screen.getAllByRole("link");', errors: [{ messageId: "pageWide" }], options: pages },
    {
      code: 'page.getByRole("link", { name: "#general" }).click();',
      errors: [{ messageId: "pageWide" }],
      options: pages,
    },
    { code: 'other.getByRole("button", { name: "Log in" });', errors: [{ messageId: "pageWide" }], options: pages },
    {
      code: 'login.page.getByRole("button", { name: "Log in" });',
      errors: [{ messageId: "pageWide" }],
      options: pages,
    },
    { code: 'screen.getByRole("button");', errors: [{ messageId: "pageWide" }] },
  ],
  valid: [
    { code: 'inPane().getByRole("button", { name: "Send" });', options: pages },
    { code: 'inSidebar(page).getByRole("link", { name: "#general" });', options: pages },
    { code: 'within(list).getByRole("button");', options: pages },
    { code: 'message.getByRole("link", { name: "Reply" });', options: pages },
    { code: 'screen.getByRole("heading", { level: 1 });', options: pages },
    { code: 'page.getByRole("list", { name: "Channels" });', options: pages },
    { code: 'screen.getByLabelText("Message");', options: pages },
    { code: "screen.getByRole(role);", options: pages },
    { code: 'other.getByRole("button");' },
  ],
});
