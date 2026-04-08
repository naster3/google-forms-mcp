import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "../tools/register-tools.js";
import type { AppContext } from "./context.js";

export function createMcpServer(context: AppContext): McpServer {
  const server = new McpServer({
    name: "google-forms-mcp",
    version: "1.0.0",
  });

  registerTools(server, context);
  return server;
}
