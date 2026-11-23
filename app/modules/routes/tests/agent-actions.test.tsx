import { adminClient, alertSaying, clientWith, newIdentity, openAt, sidebar } from "./app.tsx";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, it, onTestFinished, vi } from "vitest";
import type { CookoutClient } from "../../sdk/index.ts";
import type { Mock } from "vitest";
import { refusalOf } from "../../sdk/index.ts";

const NONE = 0;

interface Crew {
  readonly human: CookoutClient;
  readonly bot: CookoutClient;
}

async function crewOf(prefix: string): Promise<Crew> {
  const human = await newIdentity({ kind: "human", name: `${prefix}-human` });
  const bot = await newIdentity({ kind: "agent", name: `${prefix}-bot`, owner: `${prefix}-human` });
  return { bot: bot.client, human: human.client };
}

async function openSettings(client: CookoutClient): Promise<() => void> {
  const close = openAt({ client, hash: "#/people" });
  await screen.findByRole("list", { name: "Identities" });
  fireEvent.click(await within(sidebar()).findByRole("button", { name: "Settings" }));
  await screen.findByRole("region", { name: "Settings" });
  return close;
}

async function agentCard(name: string): Promise<HTMLElement> {
  const card = await screen.findByRole("group", { name: `@${name}` });
  return card;
}

async function press(name: string, button: string): Promise<void> {
  fireEvent.click(within(await agentCard(name)).getByRole("button", { name: button }));
}

async function shownToken(name: string): Promise<string> {
  const token = await within(await agentCard(name)).findByLabelText("New Identity token");
  return token.textContent;
}

async function refusalWith(client: CookoutClient): Promise<string> {
  try {
    await client.whoami();
    return "accepted";
  } catch (error: unknown) {
    return refusalOf(error).code;
  }
}

async function joinedSession(bot: CookoutClient, name: string): Promise<CookoutClient> {
  const { agentSessionToken } = await bot.join({ as: name, host: "laptop" });
  const session = clientWith(agentSessionToken);
  await session.whoami();
  return session;
}

async function nameWith(token: string): Promise<string> {
  const { identity } = await clientWith(token).whoami();
  return identity.name;
}

async function rotateIn(name: string): Promise<string> {
  await press(name, "Rotate token");
  const token = await shownToken(name);
  return token;
}

async function profileAs(client: CookoutClient, name: string): Promise<HTMLElement> {
  openAt({ client, hash: `#/people/${name}` });
  const panel = await screen.findByRole("complementary", { name: "Profile" });
  return panel;
}

function stubClipboard(): Mock<(text: string) => Promise<void>> {
  const writeText = vi.fn<(text: string) => Promise<void>>(async () => {
    await Promise.resolve();
  });
  Object.defineProperty(globalThis.navigator, "clipboard", { configurable: true, value: { writeText } });
  onTestFinished(() => {
    Reflect.deleteProperty(globalThis.navigator, "clipboard");
  });
  return writeText;
}

async function submitIn(label: string, text: string): Promise<void> {
  const form = await screen.findByRole("form", { name: label });
  fireEvent.change(within(form).getByRole("textbox"), { target: { value: text } });
  fireEvent.click(within(form).getByRole("button"));
}

it("settings lists your agents with their live session, and Revoke ends it", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { bot, human } = await crewOf("web-mine-session");
  const session = await joinedSession(bot, "web-mine-session-bot");
  const close = await openSettings(human);
  const card = await agentCard("web-mine-session-bot");
  const { textContent: before } = await within(card).findByText(/^Joined from laptop/u);
  await press("web-mine-session-bot", "Revoke session");
  await within(card).findByText("No live session");

  expect([before, await refusalWith(session)]).toStrictEqual([
    expect.stringMatching(/^Joined from laptop · last used .+ · expires .+/u),
    "agent_session_revoked",
  ]);

  close();
});

it("rotate shows the new token once, and the old one is refused", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { bot, human } = await crewOf("web-mine-rotate");
  const close = await openSettings(human);
  const token = await rotateIn("web-mine-rotate-bot");
  const card = await agentCard("web-mine-rotate-bot");
  const warning = within(card).getByText(/old token stops working/u).textContent;
  fireEvent.click(within(card).getByRole("button", { name: "Done" }));

  expect([
    await refusalWith(bot),
    await nameWith(token),
    warning,
    within(card).queryByLabelText("New Identity token"),
  ]).toStrictEqual([
    "token_revoked",
    "web-mine-rotate-bot",
    "Copy it now: it isn't shown again, and the old token stops working.",
    null,
  ]);

  close();
});

it("create makes an agent you own and shows its token once; a taken name is refused inline", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const { human } = await crewOf("web-mine-create");
  const close = await openSettings(human);
  await submitIn("Create an agent", "web-mine-create-new");
  const token = await shownToken("web-mine-create-new");
  const { identity } = await clientWith(token).whoami();
  await submitIn("Create an agent", "web-mine-create-bot");
  const alert = await alertSaying("Couldn't create the agent (identity_exists)");

  expect([identity, screen.getByRole("form", { name: "Create an agent" }).contains(alert)]).toStrictEqual([
    expect.objectContaining({ kind: "agent", owner: "web-mine-create-human" }),
    true,
  ]);

  close();
});

it("deactivate asks first, naming the agent, then marks it deactivated", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { bot, human } = await crewOf("web-mine-off");
  const close = await openSettings(human);
  await press("web-mine-off-bot", "Deactivate");
  const card = await agentCard("web-mine-off-bot");
  const refusalBefore = await refusalWith(bot);
  await press("web-mine-off-bot", "Deactivate @web-mine-off-bot");
  await within(card).findByRole("button", { name: "Reactivate" });

  expect([refusalBefore, await refusalWith(bot), within(card).getByText("(deactivated)").textContent]).toStrictEqual([
    "accepted",
    "token_revoked",
    "(deactivated)",
  ]);

  close();
});

it("an admin transfers an agent from its profile, and its owner shows at once", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await crewOf("web-mine-move");
  await newIdentity({ kind: "human", name: "web-mine-move-grace" });
  const panel = await profileAs(adminClient(), "web-mine-move-bot");
  await submitIn("Transfer @web-mine-move-bot", "web-mine-move-grace");
  await within(panel).findByText("Agent · owned by web-mine-move-grace");
  await submitIn("Transfer @web-mine-move-bot", "nobody-here");
  const alert = await alertSaying("Couldn't transfer");

  expect(panel.contains(alert)).toBe(true);
});

it("on a profile, the owner gets the agent's actions without Transfer, and others get none", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const { human } = await crewOf("web-mine-who");
  const other = await newIdentity({ kind: "human", name: "web-mine-who-other" });
  const ownerPanel = await profileAs(human, "web-mine-who-bot");
  await within(ownerPanel).findByRole("button", { name: "Rotate token" });
  const ownerForms = within(ownerPanel).queryAllByRole("form").length;
  cleanup();
  const otherPanel = await profileAs(other.client, "web-mine-who-bot");
  await within(otherPanel).findByText(/owned by web-mine-who-human/u);

  await waitFor(() => {
    expect([ownerForms, within(otherPanel).queryAllByRole("button")]).toStrictEqual([NONE, []]);
  });
});

it("copy token puts the new token on the clipboard", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const writeText = stubClipboard();
  const { human } = await crewOf("web-mine-copy");
  const close = await openSettings(human);
  const token = await rotateIn("web-mine-copy-bot");
  await press("web-mine-copy-bot", "Copy token");

  expect(writeText).toHaveBeenCalledWith(token);

  close();
});
