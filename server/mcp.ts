// MCP server (S13): stdio only, read-only. Exposes the registry's tools (all but session-scoped recall_triage) over one
// Acme org graph chosen by the required `scenario` argument. Reads go through graph().ro (GRAPH.RO_QUERY) and every
// argument goes through the registry's own coercion (S1); there is no raw-Cypher tool and no write path.
// stdout belongs to the protocol: everything else logs to stderr. Run: npm run mcp (see docs/mcp.md).
import { readFileSync } from 'node:fs';
import { fromJsonSchema, McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import type { ScenarioId, ToolResult } from '../shared/events.ts';
import { close, graph, orgGraph } from './graph/client.ts';
import { TOOLS } from './tools/registry.ts';

for (const k of ['log', 'info', 'debug'] as const) console[k] = console.error; // a stray console.log would corrupt the stream

const SCENARIOS = Object.keys(JSON.parse(readFileSync(new URL('../data/org/acme.json', import.meta.url), 'utf8')).scenarios) as ScenarioId[];
const TIMES = new Set(['at', 'since', 'until']);
const CAP = 4000; // chars of summary + rows per result; the Cypher that ran comes on top, verbatim

// Fit rows into the cap: keep everything if it fits, else shorten long lists, else drop trailing rows (worst tiers sort first).
const slim = (v: unknown, n: number): unknown =>
  Array.isArray(v) ? (v.length > n ? [...v.slice(0, n).map((x) => slim(x, n)), `+${v.length - n} more`] : v.map((x) => slim(x, n)))
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null && x !== false && x !== '' && !(Array.isArray(x) && !x.length)).map(([k, x]) => [k, slim(x, n)]))
  : v;
function fit(rows: object[], budget: number): unknown[] {
  let out: unknown[] = [];
  for (const n of [Infinity, 8, 4, 2, 1]) {
    let len = 2;
    out = rows.map((r) => slim(r, n));
    const k = out.findIndex((r) => (len += JSON.stringify(r).length + 1) > budget); // first row that overflows, -1 = all fit
    if (k < 0) return out;
    out = out.slice(0, k);
  }
  return out;
}

function render(r: ToolResult, graphName: string): CallToolResult {
  const rows = fit(r.rows, CAP - r.summary.length);
  const head = { summary: r.summary, params: r.params, rowCount: r.rows.length, ...(rows.length < r.rows.length && { rowsOmitted: r.rows.length - rows.length }), rows };
  return { content: [{ type: 'text', text: JSON.stringify(head) }, { type: 'text', text: `Cypher (GRAPH.RO_QUERY on ${graphName}):\n${r.cypher.join('\n\n')}` }] };
}

const make = () => {
  const server = new McpServer(
    { name: 'patient-zero', version: '1.0.0' },
    {
      instructions: `Read-only npm supply-chain triage over the simulated Acme org dependency graph (FalkorDB). Always pass scenario. Results are JSON {summary, params, rowCount, rows}, then the Cypher that ran. Empty, null and false fields are omitted from rows; long lists are shortened to "+N more". Times: ISO 8601 or epoch ms. Incident ids equal scenario ids.`,
    },
  );
  for (const def of Object.values(TOOLS).filter((t) => t.name !== 'recall_triage')) {
    const { required } = def.parameters;
    // The registry's time() takes ISO 8601 or epoch ms but advertises "string": accept both here so the SDK's validator agrees.
    const properties = Object.fromEntries(Object.entries(def.parameters.properties).map(([k, v]) => [k, TIMES.has(k) ? { ...(v as object), type: ['string', 'number'] } : v]));
    const scenario = { type: 'string', enum: SCENARIOS, description: 'Which Acme org graph to query; the same string is the incident id where a tool asks for one' };
    server.registerTool(
      def.name,
      {
        description: def.description,
        inputSchema: fromJsonSchema<Record<string, unknown>>({ ...def.parameters, properties: { scenario, ...properties }, required: ['scenario', ...required] }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async (args): Promise<CallToolResult> => {
        try {
          const g = graph(orgGraph(args.scenario as ScenarioId)); // throws on an unknown scenario
          const params = Object.fromEntries(Object.keys(properties).filter((k) => args[k] !== undefined).map((k) => [k, args[k]]));
          return render(await def.run(g, params), g.name);
        } catch (e) {
          console.error(`[mcp] ${def.name} failed:`, e); // detail stays on stderr, never in the reply
          return { isError: true, content: [{ type: 'text', text: 'The tool call failed. Check the arguments (scenario, ids, times as ISO 8601 or epoch ms) and that FalkorDB is reachable.' }] };
        }
      },
    );
  }
  return server;
};

serveStdio(make, { onerror: (e) => console.error('[mcp]', e) });
process.stdin.once('end', () => close().finally(() => process.exit(0))); // the client left: drop the FalkorDB socket and exit
console.error(`[mcp] patient-zero ready on stdio (${SCENARIOS.join(', ')})`);
