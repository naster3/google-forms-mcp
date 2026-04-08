import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadAuthorizedClient } from "./auth/oauth.js";
import { GoogleDriveClient } from "./google/drive-client.js";
import { GoogleFormsClient } from "./google/forms-client.js";
import { createMcpServer } from "./mcp/server.js";
import { loadEnv } from "./utils/env.js";
import { Logger } from "./utils/logger.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = new Logger(env.logLevel);
  const authClient = await loadAuthorizedClient(env, logger);
  const formsClient = new GoogleFormsClient(authClient);
  const driveClient = env.includeDriveScope ? new GoogleDriveClient(authClient) : null;

  const server = createMcpServer({
    env,
    logger,
    formsClient,
    driveClient,
  });

  const transport = new StdioServerTransport();
  logger.info("Starting Google Forms MCP server.", {
    transport: "stdio",
    includeDriveScope: env.includeDriveScope,
  });

  await server.connect(transport);
}

main().catch((error) => {
  const logger = new Logger("error");
  logger.error("Failed to start Google Forms MCP server.", {
    error: error instanceof Error ? { name: error.name, message: error.message } : { error },
  });
  process.exitCode = 1;
});
