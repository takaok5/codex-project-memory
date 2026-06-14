import { describe, expect, it } from "vitest";
import { inferModuleId } from "../../src/indexer/module-inference.js";
import { defaultProjectConfig } from "../../src/runtime/config-loader.js";

describe("module inference", () => {
  it("uses src first segment as module id", () => {
    expect(inferModuleId("src/access/access.service.ts", defaultProjectConfig("demo"))).toBe("access");
  });

  it("uses configured rootPath hints first", () => {
    const config = defaultProjectConfig("demo");
    config.modules = [{ id: "identity", name: "Identity", rootPath: "src/auth", owns: [], mustNot: [], dependencies: [], riskLevel: "normal" }];
    expect(inferModuleId("src/auth/auth.service.ts", config)).toBe("identity");
  });
});
