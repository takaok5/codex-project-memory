import { writeJson } from "../shared/json.js";
export function printResult(result, options) {
    if (options.json) {
        process.stdout.write(`${writeJson(result)}\n`);
        return;
    }
    if (result.ok) {
        if (typeof result.data === "string") {
            process.stdout.write(`${result.data}\n`);
        }
        else if (result.data !== undefined) {
            process.stdout.write(`${writeJson(result.data)}\n`);
        }
        return;
    }
    process.stderr.write(`${result.error?.message ?? "Command failed."}\n`);
}
//# sourceMappingURL=output.js.map