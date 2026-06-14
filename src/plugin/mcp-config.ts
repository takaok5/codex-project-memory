import { z } from "zod";
import { PmemError } from "../shared/errors.js";
import type { McpConfig, McpConfigOptions } from "../shared/types.js";

const mcpConfigSchema = z
  .object({
    mcpServers: z
      .object({
        "project-memory": z
          .object({
            command: z.literal("node"),
            args: z.tuple([z.literal("scripts/bootstrap-mcp.mjs")])
          })
          .strict()
      })
      .strict()
  })
  .strict();

export function buildMcpConfig(options: McpConfigOptions): McpConfig {
  return validateMcpConfig({
    mcpServers: {
      [options.serverName]: {
        command: options.command,
        args: options.args
      }
    }
  });
}

export function validateMcpConfig(value: unknown): McpConfig {
  const result = mcpConfigSchema.safeParse(value);
  if (!result.success) {
    throw new PmemError("CONFIG_ERROR", "MCP config is invalid.", {
      details: { issues: result.error.issues.map((issue) => issue.message) }
    });
  }

  return result.data;
}
