import { app } from "./app";
import { checkDatabase, pool } from "./config/database";
import { env } from "./config/env";

async function start(): Promise<void> {
  try {
    await checkDatabase();
  } catch (error) {
    console.error("Unable to connect to MySQL; API startup aborted", error);
    process.exitCode = 1;
    return;
  }

  const server = app.listen(env.PORT, "0.0.0.0", () => {
    console.info(`API listening on 0.0.0.0:${env.PORT} (${env.NODE_ENV})`);
    console.info("MySQL connection established");
  });

  const shutdown = (signal: string): void => {
    console.info(`${signal} received; shutting down API`);
    server.close(() => {
      void pool.end().then(() => process.exit(0)).catch((error: unknown) => {
        console.error("Error closing MySQL pool", error);
        process.exit(1);
      });
    });
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

void start();
