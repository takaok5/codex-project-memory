import { statSync } from "node:fs";
import path from "node:path";
const PROJECT_CWD_ENV_KEYS = [
    "PMEM_PROJECT_ROOT",
    "CODEX_PROJECT_ROOT",
    "CODEX_WORKSPACE_ROOT",
    "CODEX_REPO_ROOT",
    "CODEX_CWD",
    "WORKSPACE_ROOT",
    "PROJECT_ROOT",
    "INIT_CWD",
    "PWD"
];
export function resolveMcpProjectCwd(env = process.env, fallback = process.cwd()) {
    for (const key of PROJECT_CWD_ENV_KEYS) {
        const value = env[key];
        if (value && isUsableDirectory(value)) {
            return path.resolve(value);
        }
    }
    return path.resolve(fallback);
}
function isUsableDirectory(value) {
    try {
        return statSync(value).isDirectory();
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=project-env.js.map