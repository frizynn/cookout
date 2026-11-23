/**
 * The browser program: makes the stores on an SDK client for the page's own
 * cookout and draws the web UI in `#root`. It imports nothing from the backend.
 * There is no login yet, so the client has no token.
 */
import { CookoutApp } from "./modules/routes/index.tsx";
import { createBoard } from "./modules/board/index.ts";
import { createCookoutClient } from "./modules/sdk/index.ts";
import { createRoot } from "react-dom/client";

const root = document.querySelector("#root");

if (root !== null) {
  const client = createCookoutClient({ env: {}, url: globalThis.location.origin });
  createRoot(root).render(<CookoutApp board={createBoard(client)} />);
}
