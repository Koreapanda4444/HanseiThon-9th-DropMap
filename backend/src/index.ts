import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { closeDatabase } from "./database/oracle.js";
import { initializeDataSource } from "./services/data-source.js";

await initializeDataSource();
const app = await buildApp();

async function shutdown() {
  await app.close();
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ host: env.HOST, port: env.PORT });
