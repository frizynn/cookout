import { withoutField } from "./published-client.ts";

const { fetch: served } = globalThis;

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function droppingFetch(...request: Parameters<typeof served>): Promise<Response> {
  const response = await served(...request);
  if (!response.url.endsWith("/deactivate")) {
    return response;
  }
  const body = withoutField({ body: await response.text(), name: "identity" });
  return new Response(body, { headers: response.headers, status: response.status });
}

globalThis.fetch = droppingFetch;
