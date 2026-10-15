import type { ToolName, ToolResult } from '../../shared/events.ts';

// A selected FalkorDB graph. `ro` runs GRAPH.RO_QUERY as the pz_ro ACL user.
export interface Graph {
  name: string;
  ro(cypher: string, params?: Record<string, unknown>): Promise<{ rows: Record<string, unknown>[]; ms: number }>;
}

// One tool = parameterized Cypher from cypher.ts + a compact summary. Shared by triage, Ask loop and MCP.
export interface ToolDef<P = Record<string, unknown>> {
  name: ToolName;
  description: string; // shown to the LLM (Ask mode) and over MCP
  parameters: { type: 'object'; properties: Record<string, unknown>; required: string[]; additionalProperties: false };
  run(g: Graph, p: P): Promise<ToolResult>;
}
