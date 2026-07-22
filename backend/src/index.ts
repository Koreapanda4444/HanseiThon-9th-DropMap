import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { closeDatabase } from "./database/oracle.js";
import { initializeDataSource } from "./services/data-source.js";

await initializeDataSource();
const app = await buildApp();

let shutdownPromise: Promise<void> | null = null;

function shutdown(signal: string) {
  shutdownPromise ??= (async () => {
    try {
      await app.close();
      await closeDatabase();
    } catch (error) {
      process.exitCode = 1;
      app.log.error({ err: error, signal }, "shutdown failed");
    }
  })();
  return shutdownPromise;
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ host: env.HOST, port: env.PORT });
