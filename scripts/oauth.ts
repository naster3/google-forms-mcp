import "dotenv/config";
import { authorizeLocally } from "../src/auth/oauth.js";
import { loadEnv } from "../src/utils/env.js";
import { Logger } from "../src/utils/logger.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = new Logger(env.logLevel);
  await authorizeLocally(env, logger);
}

main().catch((error) => {
  process.stderr.write(
    `OAuth bootstrap failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
