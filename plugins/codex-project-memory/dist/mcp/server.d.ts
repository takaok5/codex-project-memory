import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MEMORY_TOOL_NAMES } from "./schemas.js";
export declare function createMcpServer(env?: {
    cwd: string;
}): McpServer;
export declare function runMcpServer(): Promise<void>;
export { MEMORY_TOOL_NAMES };
