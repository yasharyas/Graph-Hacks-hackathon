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
  cached?: boolean; // served from this server's memo of the same read-only query on an immutable demo graph; ms is from when it ran
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
// direct / devDirect: root dependencies (package.json "dependencies" / "devDependencies") to set to the same safe version
// (npm rejects an override that conflicts with a direct dependency)
// today: for a pasted repo judged on a pre-incident snapshot, what changed in today's package.json that affects this fix
export interface Remediation { repo: string; overrides: Record<string, string>; direct?: Record<string, string>; devDirect?: Record<string, string>; steps: string[]; prBody: string; today?: string[] }
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
  scope?: { kind: 'org' | 'guest'; label: string; repos: number; source?: LockSource }; // guest = a pasted repo; the hero must follow this, not the demo org
}

// Which lockfile a pasted repo was judged on: the last commit before the incident (sha, commit time), today's (no history
// available), or a pasted file (no date known). Only the first is the repo's real state at the time.
// reason (head only): no lockfile commit before the incident, or GitHub's history could not be read (rate limit, outage).
// now (snapshot only): the repo's current owner/name when GitHub redirected a renamed repo (e.g. "mochajs/mocha").
export interface LockSource { kind: 'snapshot' | 'head' | 'pasted'; sha?: string; date?: number; reason?: 'no-history' | 'unavailable'; now?: string }

export interface TimelinePoint { at: number; counts: Record<Tier, number>; scanner: number }

// Why an Ask was not answered: no model wrote one, the run's 4 model answers are used, or the graph's answers are about
// something other than what the question names.
export type Refusal = 'no-model' | 'cap' | 'off-topic';

export type TriageEvent =
  | { type: 'start'; runId: string; graph: string; incident: IncidentMeta; at: number }
  | { type: 'tool_start'; id: string; tool: ToolName; params: Record<string, unknown> }
  | { type: 'tool_result'; id: string; result: ToolResult }
  | { type: 'report'; report: Report }
  // `text`: the deterministic Verdict / Notify / Do built from the report (always complete and correct).
  // `note`: an optional analyst pick, one observation built from the report that the LLM chose (it never writes the
  // words); `mode`/`provider` describe the pick.
  // `at`: the scenario clock the narration describes (the UI dims it when the scrubber moves away).
  // `draft`: the verdict is final, but an analyst pick may still follow in the next narration event (no guard yet).
  // Ask only: `unanswered`: no model and no graph answer; `reason` says why (Refusal); `used`: model-written answers this
  // run has used, this one included (graph answers and refusals are free); `suggestions`: with `unanswered`, 2-3 questions
  // the graph answers, for the UI to offer as chips.
  | { type: 'narration'; mode: LlmMode; provider: string | null; text: string; note?: string | null; at?: number; draft?: boolean; unanswered?: boolean; reason?: Refusal; used?: number; suggestions?: string[] }
  // `claims`: every claim the server checked; the UI marks a span verified only if it appears here with ok=true.
  | { type: 'guard'; verified: number; total: number; flagged: string[]; claims?: { text: string; ok: boolean }[] }
  | { type: 'error'; message: string; requestId: string }
  | { type: 'done'; ms: number };

export type AnalyzeEvent =
  | { type: 'progress'; stage: 'fetch' | 'parse' | 'write' | 'enrich' | 'admits'; done: number; total: number }
  | { type: 'ready'; graph: string; repo: string; entries: number }
  | { type: 'error'; message: string; requestId: string };
