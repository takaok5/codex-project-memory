import * as z from "zod/v4";

export const MEMORY_TOOL_NAMES = ["memory.head", "memory.query", "memory.duplicates", "memory.frame", "memory.refresh", "memory.diff"] as const;

export function getMemoryToolSchemas() {
  return {
    "memory.head": { inputSchema: {} },
    "memory.query": {
      inputSchema: {
        intent: z.string().min(3).max(500),
        maxFiles: z.number().int().min(1).max(20).optional(),
        maxSymbols: z.number().int().min(1).max(40).optional(),
        maxWarnings: z.number().int().min(0).max(20).optional(),
        includeVisualFrame: z.boolean().optional()
      }
    },
    "memory.duplicates": {
      inputSchema: {
        kind: z.string(),
        intent: z.string().min(3).max(500),
        moduleId: z.string().optional(),
        proposedName: z.string().optional()
      }
    },
    "memory.frame": {
      inputSchema: {
        frame: z.enum(["current", "overview", "modules", "duplicates", "risks"])
      }
    },
    "memory.refresh": {
      inputSchema: {
        changedOnly: z.boolean().optional(),
        render: z.boolean().optional(),
        reason: z.string().max(200).optional()
      }
    },
    "memory.diff": {
      inputSchema: {
        from: z.string().optional(),
        to: z.string().optional()
      }
    }
  };
}
