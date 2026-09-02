export type Candidate = {
  name: string;
  website: string;
  description: string;
  source: "Y Combinator" | "Hacker News";
  sourceUrl: string;
  signal: string;
};

export type Evidence = {
  claim: string;
  url: string;
  source: string;
  capturedAt: string;
};

export type StartupAnalysis = {
  team: string;
  product: string;
  market: string;
  traction: string;
  risks: string[];
  openQuestions: string[];
  criteria: {
    workflowClarity: number;
    smbFit: number;
    technicalDepth: number;
    signalStrength: number;
    whyNow: number;
  };
};

export type Score = { total: number; reasons: string[] };

export type Recommendation = {
  decision: "Pass" | "Watch" | "Take a meeting";
  rationale: string;
  mindChanges: string[];
};

export type RunContext = { id: string; path: string };
export type RunSummary = {
  runPath: string;
  completed: number;
  failed: number;
  failures: string[];
};
