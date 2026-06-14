import * as z from "zod/v4";
export declare const MEMORY_TOOL_NAMES: readonly ["memory.head", "memory.query", "memory.duplicates", "memory.frame", "memory.refresh", "memory.diff", "memory.agent"];
export declare function getMemoryToolSchemas(): {
    "memory.head": {
        inputSchema: {};
    };
    "memory.query": {
        inputSchema: {
            intent: z.ZodString;
            maxFiles: z.ZodOptional<z.ZodNumber>;
            maxSymbols: z.ZodOptional<z.ZodNumber>;
            maxWarnings: z.ZodOptional<z.ZodNumber>;
            includeVisualFrame: z.ZodOptional<z.ZodBoolean>;
        };
    };
    "memory.duplicates": {
        inputSchema: {
            kind: z.ZodString;
            intent: z.ZodString;
            moduleId: z.ZodOptional<z.ZodString>;
            proposedName: z.ZodOptional<z.ZodString>;
        };
    };
    "memory.frame": {
        inputSchema: {
            frame: z.ZodEnum<{
                current: "current";
                overview: "overview";
                modules: "modules";
                duplicates: "duplicates";
                risks: "risks";
            }>;
        };
    };
    "memory.refresh": {
        inputSchema: {
            changedOnly: z.ZodOptional<z.ZodBoolean>;
            render: z.ZodOptional<z.ZodBoolean>;
            reason: z.ZodOptional<z.ZodString>;
        };
    };
    "memory.diff": {
        inputSchema: {
            from: z.ZodOptional<z.ZodString>;
            to: z.ZodOptional<z.ZodString>;
        };
    };
    "memory.agent": {
        inputSchema: {
            intent: z.ZodString;
            phase: z.ZodOptional<z.ZodEnum<{
                pre_task: "pre_task";
                pre_create: "pre_create";
                post_change: "post_change";
                review: "review";
                orient: "orient";
            }>>;
            artifact: z.ZodOptional<z.ZodObject<{
                kind: z.ZodEnum<{
                    function: "function";
                    service: "service";
                    controller: "controller";
                    dto: "dto";
                    type: "type";
                    interface: "interface";
                    enum: "enum";
                    repository: "repository";
                    utility: "utility";
                    route: "route";
                    migration: "migration";
                    table: "table";
                    job: "job";
                    adapter: "adapter";
                    module: "module";
                    feature: "feature";
                    class: "class";
                    method: "method";
                    const: "const";
                    provider: "provider";
                }>;
                moduleId: z.ZodOptional<z.ZodString>;
                proposedName: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            allowInit: z.ZodOptional<z.ZodBoolean>;
            allowRefresh: z.ZodOptional<z.ZodBoolean>;
            render: z.ZodOptional<z.ZodBoolean>;
        };
    };
};
