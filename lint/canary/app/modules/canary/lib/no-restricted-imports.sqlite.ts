import { DatabaseSync } from "node:sqlite";

export const open = () => new DatabaseSync(":memory:");
