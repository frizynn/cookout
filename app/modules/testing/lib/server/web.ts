import { Effect, FileSystem, Path } from "effect";
import type { Scope } from "effect";

interface BuiltWeb {
  readonly folder: string;
  readonly indexHtml: string;
  readonly scriptPath: string;
  readonly scriptText: string;
}

const INDEX_HTML =
  '<!doctype html><html><body><div id="root"></div><script type="module" src="/assets/web-test.js"></script></body></html>';
const SCRIPT_TEXT = 'console.log("the test web build");';

const builtWebFolder: Effect.Effect<BuiltWeb, never, FileSystem.FileSystem | Path.Path | Scope.Scope> = Effect.gen(
  function* makeBuiltWeb() {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const folder = yield* fs.makeTempDirectoryScoped({ prefix: "cookout-web-" });
    yield* fs.makeDirectory(path.join(folder, "assets"));
    yield* fs.writeFileString(path.join(folder, "index.html"), INDEX_HTML);
    yield* fs.writeFileString(path.join(folder, "assets", "web-test.js"), SCRIPT_TEXT);
    return { folder, indexHtml: INDEX_HTML, scriptPath: "/assets/web-test.js", scriptText: SCRIPT_TEXT };
  },
).pipe(Effect.orDie);

export { type BuiltWeb, builtWebFolder };
