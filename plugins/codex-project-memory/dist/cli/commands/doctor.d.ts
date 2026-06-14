import type { CliResult, DoctorOutput } from "../../shared/types.js";
export interface DoctorOptions {
    cwd: string;
}
export declare function cmdDoctor(options: DoctorOptions): Promise<CliResult<DoctorOutput>>;
