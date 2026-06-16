import type { CliResult, EvidenceFeedbackSignal } from "../../shared/types.js";
export interface FeedbackCliOptions {
    cwd: string;
    evidenceKey?: string;
    signal?: string;
    intent?: string;
}
export declare function cmdFeedback(options: FeedbackCliOptions): Promise<CliResult<{
    feedbackIds: number[];
    evidenceKey: string;
    signal: EvidenceFeedbackSignal;
}>>;
