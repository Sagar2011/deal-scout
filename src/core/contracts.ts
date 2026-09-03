import type {
  Candidate,
  CandidateSelection,
  CandidateProfile,
  Evidence,
  ResearchBrief,
  RunContext,
  StartupAnalysis,
} from "./models.js";
import type { MemoInput } from "../reports/memo.js";
import type { CandidateSource } from "../sources/types.js";
import type { RunThesis } from "./thesis.js";

export type CandidateEnricher = {
  name: string;
  supports(candidate: Candidate): boolean;
  enrich(candidate: Candidate): Promise<CandidateProfile>;
};

export type EvidenceCollector = {
  name: string;
  collect(candidate: Candidate): Promise<Evidence[]>;
};

export type AnalysisProvider = {
  name: string;
  analyse(
    candidate: Candidate,
    evidence: Evidence[],
    thesis: RunThesis
  ): Promise<StartupAnalysis>;
};

export type ResearchPlanner = {
  name: string;
  plan(topic: string): Promise<ResearchBrief>;
};

export type CandidateSelector = {
  name: string;
  select(
    brief: ResearchBrief,
    candidates: Candidate[],
    limit: number
  ): Promise<CandidateSelection>;
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
  evidenceCollectors?: EvidenceCollector[];
  researchPlanner?: ResearchPlanner;
  candidateSelector?: CandidateSelector;
  analyzer?: AnalysisProvider;
  renderer: ReportRenderer;
  store: RunStore;
};
