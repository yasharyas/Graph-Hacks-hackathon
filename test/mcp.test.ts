// Integration (S13): spawns the real stdio server against the dev FalkorDB (pz_acme_* built) and speaks JSON-RPC to it.
// Skipped cleanly when FalkorDB is unreachable.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { connect } from 'node:net';
import { createInterface } from 'node:readline';
import { TOOLS } from '../server/tools/registry.ts';

const host = process.env.FALKOR_HOST || '127.0.0.1';
const port = Number(process.env.FALKOR_PORT || 6380);
const up = await new Promise<boolean>((res) => {
  const s = connect(port, host, () => (s.destroy(), res(true)));
  s.setTimeout(1000, () => (s.destroy(), res(false)));
  s.on('error', () => res(false));
});

type Msg = { jsonrpc?: string; id?: number; result?: any; error?: any };
const AT = 1757338200000; // 2025-09-08T13:30:00Z

describe('mcp stdio server', { skip: !up && `FalkorDB unreachable at ${host}:${port}` }, () => {
  let child: ChildProcess;
  const out: string[] = []; // every raw stdout line
  const waiting = new Map<number, (m: Msg) => void>();
  let n = 0;
  const rpc = (method: string, params?: object) =>
    new Promise<Msg>((resolve, reject) => {
      const id = ++n;
      const t = setTimeout(() => reject(new Error(`${method} timed out`)), 20_000);
      waiting.set(id, (m) => (clearTimeout(t), resolve(m)));
      child.stdin!.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  const call = (name: string, args: object) => rpc('tools/call', { name, arguments: args });
  const text = (m: Msg) => (m.result.content as { text: string }[]).map((c) => c.text).join('\n');

  before(() => {
    child = spawn(process.execPath, ['server/mcp.ts'], {
      env: { ...process.env, FALKOR_HOST: host, FALKOR_PORT: String(port), REDIS_PASSWORD: process.env.REDIS_PASSWORD ?? 'devpass' },
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    createInterface({ input: child.stdout! }).on('line', (line) => {
      out.push(line);
      try { waiting.get(JSON.parse(line).id)?.(JSON.parse(line)); } catch { /* non-JSON line: caught by the stdout test */ }
    });
  });
  after(() => child?.kill());

  test('initialize', async () => {
    const m = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
    assert.equal(m.result.serverInfo.name, 'patient-zero');
    child.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  });

  test('tools/list: every registry tool but recall_triage, each requiring scenario', async () => {
    const tools = (await rpc('tools/list')).result.tools as { name: string; inputSchema: { required: string[] }; annotations: { readOnlyHint: boolean } }[];
    assert.deepEqual(tools.map((t) => t.name).sort(), Object.keys(TOOLS).filter((k) => k !== 'recall_triage').sort());
    assert.ok(!tools.some((t) => t.name === 'recall_triage'));
    for (const t of tools) {
      assert.ok(t.inputSchema.required.includes('scenario'), t.name);
      assert.equal(t.annotations.readOnlyHint, true, t.name);
    }
  });

  test('incident_exposure returns the rows, the summary and the exact Cypher', async () => {
    const m = await call('incident_exposure', { scenario: 'qix-2025-09-08', incident: 'qix-2025-09-08', at: AT });
    assert.ok(!m.result.isError, text(m));
    const [head] = m.result.content as { text: string }[];
    assert.ok(head.text.length <= 4000, `summary + rows is ${head.text.length} chars`);
    const body = JSON.parse(head.text);
    assert.ok(body.rows.length >= 20, `${body.rows.length} rows`);
    assert.equal(body.rows.length, body.rowCount);
    assert.match(body.summary, /LOCKED/);
    assert.equal(body.rows.find((r: { repo: string }) => r.repo === 'acme/checkout-web').tier, 'LOCKED');
    assert.match(text(m), /MATCH \(:Incident \{id: \$incident\}\)-\[:INVOLVES\]->\(bad:Version\)<-\[:RESOLVES_TO\]-\(d:Dep\)/);
  });

  test('the other scenario answers from its own graph', async () => {
    const m = await call('incident_exposure', { scenario: 'axios-2026-03-31', incident: 'axios-2026-03-31', at: Date.parse('2026-03-31T01:30:00Z') });
    assert.ok(!m.result.isError, text(m));
    assert.match(text(m), /pz_acme_axios/);
  });

  test('errors are tool errors with a generic message', async () => {
    const unknown = await call('incident_exposure', { scenario: 'nope-2000-01-01', incident: 'x', at: AT });
    assert.equal(unknown.result.isError, true);
    const noScenario = await call('concentration_risk', {});
    assert.equal(noScenario.result.isError, true);
    const badTime = await call('explain_path', { scenario: 'qix-2025-09-08', repo: 'github/docs', version: 'debug@4.4.2', at: 'garbage' });
    assert.equal(badTime.result.isError, true);
    assert.doesNotMatch(text(badTime), /\.ts|node_modules|\n\s+at /); // no stack, no paths
  });

  test('recall_triage is not callable', async () => {
    const m = await call('recall_triage', { scenario: 'qix-2025-09-08', incident: 'qix-2025-09-08' });
    assert.ok(m.error || m.result?.isError);
  });

  test('stdout carries only JSON-RPC, and the server exits when stdin closes', async () => {
    assert.ok(out.length >= 6);
    for (const line of out) assert.equal(JSON.parse(line).jsonrpc, '2.0', line);
    child.stdin!.end();
    const [code] = await once(child, 'exit');
    assert.equal(code, 0);
  });
});
