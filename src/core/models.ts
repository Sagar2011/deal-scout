export type Candidate = {
  name: string;
  website: string;
  description: string;
  source: "Y Combinator" | "Hacker News";
  sourceUrl: string;
  signal: string;
  publishedAt?: string;
};

export type Evidence = {
  claim: string;
  url: string;
  source: string;
  capturedAt: string;
};

export type Founder = {
  name: string;
  title: string;
  bio: string;
  linkedinUrl?: string;
};

export type CandidateProfile = {
  profileUrl: string;
  description: string;
  teamSize?: number;
  logoUrl?: string;
  founders: Founder[];
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
    topicFit: number;
    technicalDepth: number;
    signalStrength: number;
    whyNow: number;
  };
};

export type Score = {
  total: number;
  method: "LLM criteria" | "Evidence calibration";
  reasons: string[];
  breakdown: Array<{ label: string; score: number; maximum: number }>;
};

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
