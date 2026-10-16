// Run: node --test web/src/data/narration.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { answerLabel, citeCount, claimMap, crowded, guardLine, lines, LIST_MAX, proofFor, segments, spokenAnswer, splitCoverage, stripMarkdown, teamStarts, verdictLines, whyParts, type ProofCard, type Segment } from './narration.ts';

const verdicts = (text: string, g: Parameters<typeof segments>[1]) =>
  segments(text, g).flatMap((s) => (s.kind === 'entity' ? [[s.text, s.verdict]] : s.kind === 'cite' ? [[s.id, s.verdict]] : s.kind === 'struck' ? [[s.text, 'struck']] : []));

test('verified only when the guard lists the exact text with ok=true', () => {
  const g = { claims: [{ text: 'debug@4.4.2', ok: true }, { text: 'E1', ok: true }, { text: 'ghost/repo', ok: false }], flagged: ['ghost/repo'] };
  assert.deepEqual(verdicts('`debug@4.4.2` via [E1]; `ghost/repo`; `unlisted@1.0.0`; [E9]', g), [
    ['debug@4.4.2', 'verified'],
    ['E1', 'verified'],
    ['ghost/repo', 'flagged'],
    ['unlisted@1.0.0', 'plain'],
    ['E9', 'plain'],
  ]);
});

test('no claims from the server means nothing is verified; guard.flagged still strikes', () => {
  assert.deepEqual(verdicts('`a/b` and `c/d`', { claims: [], flagged: ['c/d'] }), [['a/b', 'plain'], ['c/d', 'flagged']]);
  assert.deepEqual(verdicts('`a/b`', null), [['a/b', 'plain']]);
});

test('a near-miss is not a match: case and version must be exact', () => {
  const g = { claims: [{ text: 'debug@4.4.2', ok: true }], flagged: [] };
  assert.deepEqual(verdicts('`Debug@4.4.2` `debug@4.4.20`', g), [['Debug@4.4.2', 'plain'], ['debug@4.4.20', 'plain']]);
});

test('unverified prose claims are struck, verified ones are left alone; [E1, E2] splits', () => {
  const g = { claims: [{ text: '21 repos', ok: true }, { text: '47 repos', ok: false }, { text: 'E1', ok: true }, { text: 'E2', ok: false }], flagged: ['47 repos', 'E2'] };
  assert.deepEqual(verdicts('21 repos are exposed, not 47 repos. See [E1, E2].', g), [['47 repos', 'struck'], ['E1', 'verified'], ['E2', 'flagged']]);
});

test('hostile text stays text: regex metacharacters in a flagged claim do not throw or match elsewhere', () => {
  const g = { claims: [{ text: 'a.b(c)', ok: false }], flagged: ['a.b(c)'] };
  assert.deepEqual(verdicts('axb(c) and a.b(c)', g), [['a.b(c)', 'struck']]);
});

test('only the first mention of an entity is a chip; a flagged one is struck every time', () => {
  const g = { claims: [{ text: 'debug@4.4.2', ok: true }, { text: 'x/y', ok: false }], flagged: ['x/y'] };
  const e = segments('`debug@4.4.2` then `debug@4.4.2` and `x/y` `x/y`', g).flatMap((s) => (s.kind === 'entity' ? [[s.text, s.first]] : []));
  assert.deepEqual(e, [['debug@4.4.2', true], ['debug@4.4.2', false], ['x/y', true], ['x/y', true]]);
});

test('markdown never reaches the screen: bold, headings, bullets, stray asterisks and a dangling backtick are gone', () => {
  assert.equal(stripMarkdown('**Verdict:** `acme/web` is **LOCKED**'), 'Verdict: acme/web is LOCKED');
  assert.equal(stripMarkdown('## Do\n- pin `debug@4.4.1`\n* rotate secrets'), 'Do\npin debug@4.4.1\nrotate secrets');
  assert.equal(stripMarkdown('Notify: Payments, Docs, `'), 'Notify: Payments, Docs, ');
  const segs = segments('**Notify the `Payments` team** first', { claims: [{ text: 'Payments', ok: true }], flagged: [] });
  assert.ok(segs.every((s) => s.kind !== 'text' || !s.text.includes('*')));
  assert.deepEqual(verdicts('**Notify the `Payments` team** first', { claims: [{ text: 'Payments', ok: true }], flagged: [] }), [['Payments', 'verified']]);
});

test('Verdict / Notify / Do lines carry their label and share one first-mention set', () => {
  const g = { claims: [{ text: 'Payments', ok: true }], flagged: [] };
  const ls = lines('Verdict: `acme/web` is LOCKED.\n**Notify:** `Payments`.\nDo: tell `Payments` and `acme/web`.', g);
  assert.deepEqual(ls.map((l) => l.label), ['Verdict', 'Notify', 'Do']);
  const firsts = ls.flatMap((l) => l.segs.flatMap((s) => (s.kind === 'entity' ? [[s.text, s.first]] : [])));
  assert.deepEqual(firsts, [['acme/web', true], ['Payments', true], ['Payments', false], ['acme/web', false]]);
  assert.equal(lines('just prose', null)[0]!.label, null);
});

test('a Why line is labelled like Verdict, Notify and Do', () => {
  assert.deepEqual(lines('Verdict: a.\nWhy: `x/y` locks `debug@4.4.2`.\nDo: b.', null).map((l) => l.label), ['Verdict', 'Why', 'Do']);
});

test('a pasted repo’s "Verdict (where it came from):" is still the Verdict label, its parenthetical kept apart', () => {
  const [v] = lines('Verdict (counterfactual: this checks the lockfile you pasted as if it had been committed on 2025-09-08): `pasted/x` would not have been exposed.', null);
  assert.equal(v!.label, 'Verdict');
  assert.equal(v!.source, 'counterfactual: this checks the lockfile you pasted as if it had been committed on 2025-09-08');
  assert.equal(v!.segs[0]?.kind === 'entity' && v!.segs[0].text, 'pasted/x');
  assert.equal(lines('Verdict: plain.', null)[0]!.source, null);
});

test('Why splits into whole path sentences, never inside a parenthetical, and joins back to the same text', () => {
  const text = '`acme/checkout-web` locks `debug@4.4.2` through `express@5.1.0` [E1], and also `chalk@5.6.1`; `github/docs` declares `^5.0.1`, which admits `chalk@5.6.1` [E2]; `mochajs/mocha` declares `^4.3.5`, which admits `debug@4.4.2` [E3] (paths for 3 of 21; +18 more in the table).';
  const parts = whyParts(segments(text, null));
  assert.equal(parts.length, 3);
  assert.equal(parts.map((p) => join([p])).join(' '), text);
  assert.match(join([parts[0]!]), /^`acme\/checkout-web` .* \[E1\], and also `chalk@5\.6\.1`;$/);
  assert.match(join([parts[2]!]), /\(paths for 3 of 21; \+18 more in the table\)\.$/);
  assert.equal(citeCount(parts.slice(1)), 2);
  assert.equal(whyParts(segments('`mochajs/mocha` declares `^4.3.5`, which admits `debug@4.4.2` [E1].', null)).length, 1);
});

test('a line with more verified names than LIST_MAX is a list (light treatment); repeats and unchecked names do not count', () => {
  const names = Array.from({ length: LIST_MAX + 1 }, (_, i) => `org/repo-${i}`);
  const g = { claims: names.map((text) => ({ text, ok: true })), flagged: [] };
  const only = (text: string, gd: typeof g | null) => lines(text, gd)[0]!.segs;
  assert.equal(crowded(only(names.map((n) => `\`${n}\``).join(', '), g)), true);
  assert.equal(crowded(only(names.slice(0, LIST_MAX).map((n) => `\`${n}\``).join(', '), g)), false);
  assert.equal(crowded(only(names.map((n) => `\`${n}\``).join(', '), null)), false, 'nothing verified, nothing to lighten');
  assert.equal(crowded(only(`${names.map((n) => `\`${n}\``).join(', ')}, \`${names[0]}\``, g)), true);
  assert.equal(crowded(only(`\`${names[0]}\` \`${names[0]}\` \`${names[0]}\` \`${names[0]}\` \`${names[0]}\` \`${names[0]}\``, g)), false, 'a repeat is not a new chip');
});

test('each Ask answer says how it was produced, with the provider when there is one', () => {
  assert.equal(answerLabel({ mode: 'template', provider: null }), 'Answered from the graph');
  assert.equal(answerLabel({ mode: 'live', provider: null }), 'LLM answer: the model wrote the words');
  assert.equal(answerLabel({ mode: 'template', provider: null, unanswered: true }), 'Not answered: no language model is available');
  assert.equal(answerLabel({ mode: 'live', provider: 'groq' }), 'LLM answer: the model wrote the words · groq');
});

test('the coverage line is split off only when it is a separate last line that counts something', () => {
  assert.deepEqual(splitCoverage('Platform owns four.\n\n6 of 14 prod-only repos listed.'), { body: 'Platform owns four.', coverage: '6 of 14 prod-only repos listed.' });
  assert.equal(splitCoverage('Coverage: 6 of 14 repos').coverage, null); // a one-line answer is the answer
  assert.equal(splitCoverage('Verdict: x.\nDo: fix 3 of 5 repos').coverage, null);
  assert.equal(splitCoverage('A.\nCoverage: **6 of 14** repos.').coverage, '6 of 14 repos.');
});

const card = (id: string, tool: string, rows: Record<string, unknown>[], evidence: string[], params: Record<string, unknown> = {}, summary = ''): ProofCard => ({ id, tool, params, result: { summary, rows, evidence } });
const cards: ProofCard[] = [
  card('0:t1', 'suspect_versions', [{ version: 'debug@4.4.2', package: 'debug' }], ['qix', 'debug@4.4.2'], { maintainer: 'qix' }),
  card('0:t2', 'incident_exposure', [{ repo: 'acme/web', team: 'Payments' }, { repo: 'github/docs', team: 'Docs' }], ['acme/web', 'Payments', 'github/docs', 'Docs'], { incident: 'qix-2025-09-08' }, 'at 13:30: 1 LOCKED of 21 repos'),
  card('0:t3', 'route_owners', [{ team: 'Docs', repos: ['github/docs'] }, { team: 'Payments', repos: ['acme/web'] }], ['Docs', 'Payments']),
  card('0:t4', 'explain_path', [{ repo: 'github/docs', version: 'chalk@5.6.1', id: 'E2' }, { repo: 'github/docs', version: 'chalk@5.6.1' }], ['github/docs']),
  card('0:t5', 'draft_remediation', [{ repo: 'acme/web', overrides: { debug: '4.4.1' } }], ['acme/web', 'debug@4.4.1']),
];

test('proofFor: an [E#] is the explain_path row that carries it', () => {
  const p = proofFor('E2', cards)!;
  assert.equal(p.card.tool, 'explain_path');
  assert.equal(p.row, 0);
  assert.equal(proofFor('E9', cards), null);
});

test('proofFor: the card whose first column is the entity wins, and its row is named', () => {
  assert.deepEqual([proofFor('acme/web', cards)!.card.tool, proofFor('acme/web', cards)!.row], ['incident_exposure', 0]);
  assert.deepEqual([proofFor('Payments', cards)!.card.tool, proofFor('Payments', cards)!.row], ['route_owners', 1]); // not the exposure card, where team is the 2nd column
  assert.deepEqual([proofFor('debug@4.4.2', cards)!.card.tool, proofFor('debug@4.4.2', cards)!.row], ['suspect_versions', 0]);
});

test('proofFor: evidence, arguments and the summary count when no row holds the entity', () => {
  assert.equal(proofFor('debug@4.4.1', cards)!.card.tool, 'draft_remediation');
  assert.equal(proofFor('debug@4.4.1', cards)!.row, null);
  assert.equal(proofFor('qix-2025-09-08', cards)!.card.tool, 'incident_exposure'); // an argument
  assert.equal(proofFor('21 repos', cards)!.card.tool, 'incident_exposure'); // a count in the summary
  assert.equal(proofFor('nothing/here', cards), null);
});

test('claimMap groups verified claims by card in feed order and keeps the rest apart', () => {
  const m = claimMap([{ text: 'Payments', ok: true }, { text: 'acme/web', ok: true }, { text: 'E2', ok: true }, { text: 'ghost', ok: false }, { text: '99 widgets', ok: true }, { text: 'acme/web', ok: true }], cards);
  assert.deepEqual(m.groups.map((g) => [g.card.tool, g.claims]), [['incident_exposure', ['acme/web']], ['route_owners', ['Payments']], ['explain_path', ['E2']]]);
  assert.deepEqual(m.unmatched, ['99 widgets']);
});

const join = (ls: Segment[][]) => ls.flat().map((x) => (x.kind === 'text' ? x.text : x.kind === 'entity' ? `\`${x.text}\`` : x.kind === 'cite' ? `[${x.id}]` : x.text)).join('');

test('the verdict splits into a headline and one line per tier, and the lines join back to the identical text', () => {
  const text = '21 of 21 repos are exposed to the `qix` account compromise. LOCKED, 1 repo (`acme/checkout-web`): rotate secrets. WOULD_PULL, 20 repos (13 prod): safe from the lockfile. Marked remediated: `a/b`.';
  const g = { claims: [{ text: 'acme/checkout-web', ok: true }], flagged: [] };
  const ls = verdictLines(segments(text, g));
  assert.equal(ls.length, 4);
  assert.equal(join(ls), text);
  assert.match(join([ls[1]!]), /^LOCKED, 1 repo/);
  assert.match(join([ls[2]!]), /^WOULD_PULL, 20 repos/);
  assert.match(join([ls[3]!]), /^Marked remediated:/);
  assert.equal(ls[1]!.find((x) => x.kind === 'entity')?.kind === 'entity' && (ls[1]!.find((x) => x.kind === 'entity') as { verdict: string }).verdict, 'verified');
  assert.equal(verdictLines(segments('A pasted repo is safe.', null)).length, 1);
});

test('a roster line opens a new row at each team (with or without its channel), never at a repo', () => {
  const segs = segments('Complete list: `Payments`: `acme/checkout-web` (LOCKED); `CLI` (`#team-cli`): `npm/cli`, `x/y` (dev).', null);
  const starts = [...teamStarts(segs)].map((i) => (segs[i] as { text: string }).text);
  assert.deepEqual(starts, ['Payments', 'CLI']);
});

test('the spoken answer is the answer in plain words, cut at a sentence', () => {
  assert.equal(spokenAnswer('`acme/checkout-web` is LOCKED [E1]. Rotate secrets.'), 'acme/checkout-web is LOCKED. Rotate secrets.');
  const long = spokenAnswer(`${'Platform owns four repos. '.repeat(20)}`, 120);
  assert.ok(long.length < 160 && long.endsWith('The full answer is in the feed.'), long);
});

test('a model answer says its wording is the model’s; a graph answer counts traced claims', () => {
  assert.equal(guardLine({ verified: 12, total: 12 }, true), '12 of 12 names and numbers found in the graph results; the wording is the model’s');
  assert.equal(guardLine({ verified: 61, total: 61 }, false), '61 of 61 claims traced to a graph query');
  assert.equal(guardLine({ verified: 1, total: 1 }, false), '1 of 1 claim traced to a graph query');
});

test('a label regex stays linear on a model answer full of spaces (it ran 9 s on 4,000)', () => {
  const t0 = performance.now();
  lines('Verdict' + ' '.repeat(100_000) + 'x', null);
  assert.ok(performance.now() - t0 < 200);
});
