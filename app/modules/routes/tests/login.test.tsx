import { adminClient, anonymousClient, newIdentity, openAt, sessionOf } from "./app.tsx";
import { expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { createCookoutClient } from "../../sdk/index.ts";

function logInWith(token: string): void {
  fireEvent.change(screen.getByLabelText("Token"), { target: { value: token } });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
}

async function refusalShownFor(token: string): Promise<readonly unknown[]> {
  const close = openAt({ client: anonymousClient(), hash: "#/" });
  await screen.findByRole("form", { name: "Log in" });
  logInWith(token);
  const alert = await screen.findByRole("alert");
  const shown = [alert.textContent, screen.queryByRole("list")];
  close();
  return shown;
}

it("with no session, every route shows the login form and no refusal", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const close = openAt({ client: anonymousClient(), hash: "#/channels/general" });

  const form = await screen.findByRole("form", { name: "Log in" });

  expect([form.textContent, screen.queryByRole("alert")]).toStrictEqual(["TokenLog in", null]);

  close();
});

it("a login started before the app is drawn still lands on the channel list", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await adminClient().createChannel({ name: "web-login-early" });
  const human = await newIdentity({ kind: "human", name: "web-login-early-human" });
  const session = sessionOf(anonymousClient());
  session.logIn(human.token);
  const close = openAt({ client: human.client, hash: "#/", session });

  const link = await screen.findByRole("link", { name: "#web-login-early" });

  expect(link.getAttribute("href")).toBe("#/channels/web-login-early");

  close();
});

it("logging in with a human token shows the channel list", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  await adminClient().createChannel({ name: "web-login-lands-here" });
  const human = await newIdentity({ kind: "human", name: "web-login-human" });
  const session = sessionOf(anonymousClient());
  const close = openAt({ client: human.client, hash: "#/", session });
  await screen.findByRole("form", { name: "Log in" });

  logInWith(human.token);
  const link = await screen.findByRole("link", { name: "#web-login-lands-here" });

  expect(link.getAttribute("href")).toBe("#/channels/web-login-lands-here");

  close();
});

it("logging in with an agent's token is refused with human_only", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { token } = await newIdentity({ kind: "agent", name: "web-login-agent" });

  await expect(refusalShownFor(token)).resolves.toStrictEqual([
    "Couldn't log in (human_only): Only a human identity can log in to the web UI, and web-login-agent is an agent.",
    null,
  ]);
});

it("logging in with a token that was rotated away is refused with token_revoked", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { token } = await newIdentity({ kind: "human", name: "web-login-rotated" });
  await adminClient().rotateToken("web-login-rotated");

  await expect(refusalShownFor(token)).resolves.toStrictEqual([
    expect.stringMatching(/^Couldn't log in \(token_revoked\)/u),
    null,
  ]);
});

it("the login route says who is logged in", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const { client } = await newIdentity({ kind: "human", name: "web-login-who" });
  const close = openAt({ client, hash: "#/login" });

  const link = await screen.findByRole("link", { name: "Logged in as @web-login-who. See the inbox" });

  expect(link.getAttribute("href")).toBe("#/inbox");

  close();
});

it("the login view says so when the server can't be reached", { timeout: 5000 }, async () => {
  expect.hasAssertions();

  const client = createCookoutClient({ env: {}, url: "http://127.0.0.1:1" });
  const close = openAt({ client, hash: "#/" });

  const alert = await screen.findByRole("alert");

  expect(alert.textContent).toMatch(/^Couldn't log in \(unreachable\)/u);

  close();
});
