/* GraphStatsSheet: "Built on FalkorDB" before any triage has run (after one, the pill opens the Graph stats tab under the
 * table, which adds this run's per-tool figures). Props: open, onClose, scenario. Shows the demo graph the incident runs
 * on: its name, how many nodes of each label and edges of each type it holds, and the time FalkorDB took to count them
 * (GET /api/stats; kept per scenario). A Sheet, so Esc, Back and the backdrop close it and focus returns to the pill.
 */
import { useId, useState } from 'react';
import type { ScenarioId } from '../data/types.ts';
import { fmtMs } from '../data/format.ts';
import { useStats } from '../data/useStats.ts';
import { Button, IconButton } from './Button.tsx';
import { Close } from './icons/Glyphs.tsx';
import { Sheet } from './Sheet.tsx';

const count = (n: number) => n.toLocaleString('en-US');

function Counts({ title, rows }: { title: string; rows: { name: string; count: number }[] }) {
  return (
    <section>
      <h3 className="label-caps mb-1.5">
        {title} <span className="font-sans tabular-nums">· {count(rows.reduce((n, r) => n + r.count, 0))}</span>
      </h3>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs">
        {rows.map((r) => (
          <div key={r.name} className="contents">
            <dt className="font-mono text-fg-1">{r.name}</dt>
            <dd className="text-right font-mono text-fg-0 tabular-nums">{count(r.count)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function GraphStatsSheet({ open, onClose, scenario }: { open: boolean; onClose: () => void; scenario: ScenarioId }) {
  const id = useId();
  const [retry, setRetry] = useState(0);
  const { data, error, loading } = useStats(scenario, open, retry);
  return (
    <Sheet open={open} onClose={onClose} labelledBy={`${id}-title`}>
      <div className="flex h-full flex-col">
        <div className="flex items-start gap-3 border-b border-line-1 p-4">
          <div className="min-w-0 flex-1">
            <h2 id={`${id}-title`} className="font-display text-xl font-extrabold text-fg-0">
              Graph stats
            </h2>
            <p className="mt-1 text-sm text-fg-1">
              The FalkorDB graph this incident is triaged on{data ? <>: <span className="font-mono text-xs text-fg-0">{data.graph}</span></> : ''}. Run a triage to add the queries it runs.
            </p>
          </div>
          <IconButton label="Close" icon={<Close size={20} />} onClick={onClose} />
        </div>
        <div className="scroll-pane min-h-0 flex-1 p-4" aria-busy={loading || undefined}>
          {data ? (
            <div className="flex flex-col gap-5">
              <Counts title="Nodes" rows={data.nodes.map((n) => ({ name: n.label, count: n.count }))} />
              <Counts title="Edges" rows={data.edges.map((e) => ({ name: e.type, count: e.count }))} />
              <p className="text-xs text-fg-2">Counted in {fmtMs(data.ms)} of FalkorDB time. Triage records are this session&rsquo;s own memory (recall_triage).</p>
            </div>
          ) : error ? (
            <div role="alert" className="flex flex-col items-start gap-2 rounded-sm border border-line-3 p-3 text-sm">
              <p className="text-fg-0">{error}</p>
              <Button onClick={() => setRetry((n) => n + 1)}>Retry</Button>
            </div>
          ) : (
            <p role="status" className="text-sm text-fg-1">
              Counting nodes and edges&hellip;
            </p>
          )}
        </div>
      </div>
    </Sheet>
  );
}
