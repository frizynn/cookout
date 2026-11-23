import { readFileSync } from "node:fs";
import { rollbackImage } from "./lib/rollback-image.ts";

const STDIN = 0;
const image = rollbackImage(readFileSync(STDIN, "utf8"));

if (image === "") {
  console.error("rollback-image: no machine runs an image, so a failed deploy has nothing to roll back to");
  process.exitCode = 1;
} else {
  console.log(image);
}
