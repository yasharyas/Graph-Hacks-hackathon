// Contract between the server (producer) and the web app (consumer).
// Owned by the orchestrator: workers read this file, never edit it.

export type Tier = 'LOCKED' | 'WOULD_PULL' | 'MAINTAINER' | 'CLEAN';
export type LlmMode = 'live' | 'replay' | 'template';
export type ScenarioId = 'qix-2025-09-08' | 'axios-2026-03-31';

export type ToolName =
  | 'find_target'
  | 'suspect_versions'
  | 'incident_exposure'
  | 'maintainer_blast_radius'
  | 'explain_path'
  | 'route_owners'
  | 'concentration_risk'
  | 'draft_remediation'
  | 'scanner_view'
  | 'filter_exposures'
  | 'recall_triage';

export interface ToolResult {
  tool: ToolName;
  summary: string; // one line: shown on the card, given to the LLM
  rows: Record<string, unknown>[];
  evidence: string[]; // entity strings the guard accepts: repo ids, name@version, maintainers, teams
  cypher: string[]; // every query the tool ran, verbatim from server/tools/cypher.ts
  params: Record<string, unknown>;
  ms: number; // FalkorDB internal execution time, summed over queries
  truncated?: number; // rows withheld from the LLM summary
}

export interface IncidentMeta {
  id: ScenarioId;
  title: string;
  maintainer: string | null; // compromised npm account, only when a cited source names it
  firstPublishAt: number; // epoch ms
  alertAt: number; // first public alert
  advisoryAt: number; // first OSV record published
  removedAt: number; // approximate (packument has no removal time)
  versions: { id: string; publishedAt: number }[]; // malicious name@version ids
  sources: string[];
  // First moment any repo in this graph was exposed (LOCKED or WOULD_PULL). "Minutes ahead" everywhere is
  // advisoryAt - firstExposureAt, so the landing figure and the report figure can never disagree.
  firstExposureAt?: number | null;
}

export interface Exposure {
  repo: string; // "owner/name"
  synthetic: boolean;
  team: string | null;
  tier: Tier;
  versions: string[]; // malicious name@version ids reached
  depth: number; // shallowest hit (0 = declared by the repo root)
  dev: boolean; // true when every hit is dev-only
  ranges: string[]; // declared ranges that admit a bad version (WOULD_PULL)
  packages: string[]; // MAINTAINER tier: compromised account's packages in the tree
  remediated: { at: number; action: string } | null;
  locked?: string[]; // what the lockfile actually pins for each affected package, e.g. "chalk@5.4.1" (safe) or the bad version (LOCKED)
}

export interface ExposurePath {
  id: string; // evidence id cited by the narrative, e.g. "E3"
  repo: string;
  version: string; // target malicious name@version
  kind: 'RESOLVES_TO' | 'ADMITS';
  range: string | null; // range on the final hop (ADMITS)
  hops: number;
  chain: string[]; // [repo, "name@version", ...] root first
  lockPaths: string[]; // lockfile key per chain node ("" = root)
}

export interface OwnerGroup { team: string; channel: string; repos: string[] }
export interface Remediation { repo: string; overrides: Record<string, string>; steps: string[]; prBody: string }
export interface Notice { team: string; channel: string; text: string }
export interface Concentration { maintainer: string; influence: number; packages: number; reposReached: number }
export interface ScannerHit { repo: string; version: string; advisory: string }

export interface Report {
  incident: IncidentMeta;
  at: number; // scenario clock (epoch ms)
  counts: Record<Tier, number>;
  minutesAhead: number; // advisoryAt minus first moment the graph showed exposure
  scanner: ScannerHit[]; // what an advisory-based scanner sees at `at`
  grepCount: number; // repos where a bad package name appears at all (no path, no owner)
  exposures: Exposure[]; // non-CLEAN repos
  paths: ExposurePath[];
  owners: OwnerGroup[];
  remediations: Remediation[];
  notices: Notice[];
  concentration: Concentration[];
  scope?: { kind: 'org' | 'guest'; label: string; repos: number }; // guest = a pasted repo; the hero must follow this, not the demo org
}

export interface TimelinePoint { at: number; counts: Record<Tier, number>; scanner: number }

export type TriageEvent =
  | { type: 'start'; runId: string; graph: string; incident: IncidentMeta; at: number }
  | { type: 'tool_start'; id: string; tool: ToolName; params: Record<string, unknown> }
  | { type: 'tool_result'; id: string; result: ToolResult }
  | { type: 'report'; report: Report }
  // `text`: the deterministic Verdict / Notify / Do built from the report (always complete and correct).
  // `note`: an optional short analyst summary written by the LLM (guarded); `mode`/`provider` describe the note.
  // `at`: the scenario clock the narration describes (the UI dims it when the scrubber moves away).
  | { type: 'narration'; mode: LlmMode; provider: string | null; text: string; note?: string | null; at?: number }
  // `claims`: every claim the server checked; the UI marks a span verified only if it appears here with ok=true.
  | { type: 'guard'; verified: number; total: number; flagged: string[]; claims?: { text: string; ok: boolean }[] }
  | { type: 'error'; message: string; requestId: string }
  | { type: 'done'; ms: number };

export type AnalyzeEvent =
  | { type: 'progress'; stage: 'fetch' | 'parse' | 'write' | 'enrich' | 'admits'; done: number; total: number }
  | { type: 'ready'; graph: string; repo: string; entries: number }
  | { type: 'error'; message: string; requestId: string };
