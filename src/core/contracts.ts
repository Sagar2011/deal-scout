import type {
  Candidate,
  CandidateProfile,
  Evidence,
  RunContext,
  StartupAnalysis,
} from "./models.js";
import type { MemoInput } from "../reports/memo.js";
import type { CandidateSource } from "../sources/types.js";

export type CandidateEnricher = {
  name: string;
  supports(candidate: Candidate): boolean;
  enrich(candidate: Candidate): Promise<CandidateProfile>;
};

export type AnalysisProvider = {
  name: string;
  analyse(candidate: Candidate, evidence: Evidence[]): Promise<StartupAnalysis>;
};

export type QueryExpander = {
  name: string;
  expand(topic: string): Promise<string[]>;
};

export type ReportRenderer = {
  renderMemo(input: MemoInput): string;
  renderRunReport(topic: string, entries: MemoInput[]): string;
};

export type RunStore = {
  createRun(rootDir: string, topic: string): Promise<RunContext>;
  writeJson(
    run: RunContext,
    relativePath: string,
    value: unknown
  ): Promise<void>;
  writeText(
    run: RunContext,
    relativePath: string,
    value: string
  ): Promise<void>;
};

export type PipelineDependencies = {
  sources: CandidateSource[];
  enrichers: CandidateEnricher[];
  queryExpander?: QueryExpander;
  analyzer?: AnalysisProvider;
  renderer: ReportRenderer;
  store: RunStore;
};
