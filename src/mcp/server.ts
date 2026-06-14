import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { VERSION } from "../shared/version.js";
import { getMemoryToolSchemas, MEMORY_TOOL_NAMES } from "./schemas.js";
import { toMcpToolError } from "./errors.js";
import { handleMemoryHead } from "./tools/head.js";
import { handleMemoryQuery } from "./tools/query.js";
import { handleMemoryDuplicates } from "./tools/duplicates.js";
import { handleMemoryFrame } from "./tools/frame.js";
import { handleMemoryRefresh } from "./tools/refresh.js";
import { handleMemoryDiff } from "./tools/diff.js";
import { handleMemoryAgent } from "./tools/agent.js";
import { resolveMcpProjectCwd } from "./project-env.js";

export function createMcpServer(env = { cwd: resolveMcpProjectCwd() }): McpServer {
  const server = new McpServer({ name: "project-memory", version: VERSION });
  const schemas = getMemoryToolSchemas();
  register(server, "memory.head", schemas["memory.head"], async (input) => handleMemoryHead(input, env));
  register(server, "memory.query", schemas["memory.query"], async (input) => handleMemoryQuery(input as never, env));
  register(server, "memory.duplicates", schemas["memory.duplicates"], async (input) => handleMemoryDuplicates(input as never, env));
  register(server, "memory.frame", schemas["memory.frame"], async (input) => handleMemoryFrame(input as never, env));
  register(server, "memory.refresh", schemas["memory.refresh"], async (input) => handleMemoryRefresh(input as never, env));
  register(server, "memory.diff", schemas["memory.diff"], async (input) => handleMemoryDiff(input as never, env));
  register(server, "memory.agent", schemas["memory.agent"], async (input) => handleMemoryAgent(input as never, env));
  return server;
}

export async function runMcpServer(): Promise<void> {
  const server = createMcpServer();
  await server.connect(new StdioServerTransport());
}

export { MEMORY_TOOL_NAMES };

function register(server: McpServer, name: (typeof MEMORY_TOOL_NAMES)[number], schema: { inputSchema: Record<string, unknown> }, handler: (input: unknown) => Promise<unknown>): void {
  const registerTool = server.registerTool.bind(server) as (...args: unknown[]) => void;
  registerTool(
    name,
    {
      description: `Codex Project Memory ${name}`,
      inputSchema: schema.inputSchema
    },
    async (input: unknown) => {
      try {
        const structuredContent = await handler(input);
        return { content: [{ type: "text", text: JSON.stringify(structuredContent) }], structuredContent };
      } catch (error) {
        const structuredContent = toMcpToolError(error);
        return { isError: true, content: [{ type: "text", text: JSON.stringify(structuredContent) }], structuredContent };
      }
    }
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMcpServer().catch(() => {
    process.exitCode = 1;
  });
}
