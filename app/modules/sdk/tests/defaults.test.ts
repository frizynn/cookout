import { CookoutError, createCookoutClient } from "../index.ts";
import { expect, it } from "vitest";

function thrownBy(make: () => unknown): unknown {
  try {
    make();
  } catch (error: unknown) {
    return error;
  }
  return "nothing";
}

it("the SDK refuses with url_missing when there is no URL", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const noUrl = thrownBy(() => createCookoutClient({ env: {} }));
  const emptyUrl = thrownBy(() => createCookoutClient({ env: { COOKOUT_URL: "" } }));

  expect(noUrl).toBeInstanceOf(CookoutError);
  expect(noUrl).toMatchObject({ code: "url_missing", status: 0 });
  expect(emptyUrl).toMatchObject({ code: "url_missing", status: 0 });
});

it("given a URL and no env, the SDK reads the rest from the process's environment and makes a client", {
  timeout: 1000,
}, () => {
  expect.hasAssertions();

  const made = thrownBy(() => createCookoutClient({ url: "http://127.0.0.1:1" }));

  expect(made).toBe("nothing");
});
