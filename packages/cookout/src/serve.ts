import { randomLeaseId, randomToken, startServer } from "@ai-hero/cookout-server";
import type { Clock } from "@ai-hero/cookout-server";
import { openSqliteStorage } from "@ai-hero/cookout-storage-sqlite";

export type ServeOptions = {
  /** The SQLite database file. Created if it doesn't exist. */
  databasePath: string;
  /** 0 picks a free port. */
  port: number;
  host: string;
  /** Prints one JSON line on stdout. */
  print(line: Record<string, unknown>): void;
};

export type RunningCookout = {
  url: string;
  /** Stops the server, then closes the database. */
  close(): Promise<void>;
};

/** The real clock. This start-up path is the one place that reads the time. */
const systemClock: Clock = {
  // eslint-disable-next-line no-restricted-syntax -- start-up wires the real clock (CODING_STANDARDS.md).
  now: () => new Date(),
};

/**
 * `cookout serve`: the server on SQLite with the real clock and token source.
 * On first boot it prints the admin token, once.
 */
export async function serve(options: ServeOptions): Promise<RunningCookout> {
  const storage = openSqliteStorage({ path: options.databasePath });
  try {
    const server = await startServer({
      storage,
      clock: systemClock,
      newToken: randomToken,
      newLeaseId: randomLeaseId,
      port: options.port,
      host: options.host,
    });
    if (server.adminToken !== undefined) {
      options.print({
        adminToken: server.adminToken,
        identity: "admin",
        message: "First boot: this is the admin token. It is shown only this once; keep it safe.",
      });
    }
    options.print({ listening: server.url, database: options.databasePath });
    return {
      url: server.url,
      close: async () => {
        await server.close();
        await storage.close();
      },
    };
  } catch (error) {
    await storage.close();
    throw error;
  }
}
