import type { Reader, ReaderSources, ReaderTools } from "./reader.ts";
import { createReader } from "./reader.ts";

interface Reading {
  readonly reader: (key: string, sources: ReaderSources) => Reader;
}

function createReading(tools: ReaderTools): Reading {
  const readers = new Map<string, Reader>();
  return {
    reader: (key, sources) => {
      const reader = readers.get(key) ?? createReader({ ...tools, sources });
      readers.set(key, reader);
      return reader;
    },
  };
}

export { type Reading, createReading };
