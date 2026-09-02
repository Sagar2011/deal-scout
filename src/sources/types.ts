import type { Candidate } from "../core/models.js";

export type CandidateSource = {
  findCandidates(topic: string, limit: number): Promise<Candidate[]>;
};

export type HttpClient = {
  get<T>(url: string, config?: unknown): Promise<{ data: T }>;
  post<T>(url: string, body?: unknown, config?: unknown): Promise<{ data: T }>;
};
