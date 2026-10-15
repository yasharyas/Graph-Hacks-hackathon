# Decisions

Short records of arena picks and other non-obvious choices. Newest first.

## Phase 0 gate — spikes S1–S4, 2026-10-15

- **S1 FalkorDB 4.22.1** (`falkordb/falkordb@sha256:b0bdcac…`): `shortestPath` is only allowed in `WITH`/`RETURN` (`WITH shortestPath((root)-[:REQUIRES*0..]->(x)) AS p`); `*0..` handles direct deps natively, so no special case. `allShortestPaths` only in `MATCH`; `algo.SPpaths({…pathCount:3})` gives k-shortest. `CALL algo.pageRank(...) YIELD node, score SET node.pagerank = score` works. Params, list slicing, `metadata` execution time, `GRAPH.EXPLAIN`, `GRAPH.CONSTRAINT` (async, returns PENDING) all work. 20k nodes + 20k edges via UNWIND batches of 400: 435 ms; graph 7 MB; `GRAPH.COPY` 251 ms; 60-hop shortestPath 5.5 ms internal.
- **S8 verified:** ACL user `pz_ro` (`+GRAPH.RO_QUERY +GRAPH.EXPLAIN +GRAPH.LIST +PING +HELLO +CLIENT +INFO`) reads; `GRAPH.QUERY`/`GRAPH.DELETE` get NOPERM; `RO_QUERY` rejects writes.
- **S3 single container** (`falkordb/falkordb-server@sha256:2e99eb1…`, Debian trixie, glibc 2.41 + Node from `node:24-trixie-slim`): the base image's ENTRYPOINT (`run.sh`) silently ignores our CMD and starts an open Redis — **override ENTRYPOINT**. No `useradd` in the image: run as numeric `USER 10001:10001`. Under `--memory=512m --cpus=0.1`: 6 graphs × 40k nodes = 165 MB total (Redis 146 MB, Node 91 MB RSS); seeding at boot took 23 s, so bake the RDB. Image 127 MB.
- **S4 LLMs:** Groq `qwen/qwen3.8-27b` (narration 0.44 s, tool call 0.29 s), `openai/gpt-oss-120b` (needs `max_tokens` ≥ ~600 or reasoning eats the output), Gemini `gemini-3.5-flash-lite` (1.5 s / 1.2 s) — all return correct tool calls through `chat()`. A Flash-Lite narration said mocha was "currently using" the bad version, which the guard can't catch (verbs aren't entities): the system prompt now forbids "uses/installed/compromised" for WOULD_PULL.
- **Local dev:** a native Windows Redis owns host port 6379, so dev FalkorDB maps **6380**.
- **Fonts:** Fontshare ITF FFL forbids redistribution via a public repo → Satoshi/Cabinet Grotesk are git-ignored and fetched at build (`npm run fonts`); Martian Mono (OFL) is committed.
- **Gate:** 58 tests green, `tsc` clean, secret scan clean, history rebuilt to 4 commits as `yasharyas`. All Phase 0 exit criteria met; no fallback needed.

## Narrative guard (`server/agent/guard.ts`) — arena, 2026-10-15

- **Runners:** A (Opus, 43 lines), B (Sonnet, 53), C (Fable, 39). All 7/7, all linear on 100 KB adversarial input.
- **Cross-judge (Haiku):** B 18, A 13, C 13. **Base: B** — the only one reading "1,234 packages" as 1234 (A and C claimed a wrong "234 packages"); named anchored classifiers (NPM, REPO, PROSE) are the easiest to explain; `stop()` keeps sentence punctuation out of spans. My read agreed.
- **Grafted:** A's backtick discipline (no space just inside the ticks, so "Use \` carefully and \`npm\`" claims `npm`, not prose); cite lists `[E1, E2]` (none had it); `^`/`~` in name@range tokens (`debug@^4.3.5`); file paths and tool pairs (`lib/index.js`, `npm/yarn`, `dev/prod`) are not repo claims unless already a known entity.
- **Rejected:** A's single dense alternation regex (correct, hard to explain); C's trailing-hyphen spans; a dictionary for prose (stoplist is the ponytail ceiling, documented in code).
- **Known limits:** unknown repos with a file-like extension (`vercel/next.js`) are not claimed; "twenty-one repos" is not parsed; hypotheticals ("e.g. 3 repos") are still checked. The narration prompt asks for backticked entities, which sidesteps most of this.
- **Verification:** 8 guard tests, adversarial 100 KB worst case 21 ms (budget 50 ms).

## ADMITS window + safe version (`server/ingest/admits.ts`) — arena, 2026-10-15

- **Runners:** A (Opus, 31 lines), B (Sonnet, 34), C (Fable, 31). All 7/7 and all converged on a single pass (earliest later version that satisfies the range and outranks the bad one) instead of re-running `maxSatisfying` at every publish time.
- **Cross-judge (Haiku):** totals tied 13/13/13; correctness decided. **Base: A** — loose parsing like npm, fail-closed malicious-duplicate handling in `safeVersion`, null on degenerate times. My read agreed.
- **Grafted (judge-found bugs):** a null `removedAt` (DB NULL for a still-live release) made A return null — hiding live exposure; now `removedAt ?? Infinity`. A non-string spec (undeclared package) threw; now null. Both are regression tests, plus the duplicate-malicious pin case where B and C would have recommended pinning the malicious version.
- **Known limit (tell the judges):** `latest` is modelled as "highest stable", not as a moving dist-tag; a later lower backport can move npm's `latest` and end a window earlier in reality. No dist-tag history exists to model it.
- **Verification:** 8 tests.

## Lockfile parser (`server/ingest/lockfile.ts`) — arena, 2026-10-15

- **Runners:** A (Opus), B (Sonnet), C (Fable), each in its own worktree. Rubric: `test/lockfile.test.ts` (9 tests incl. two real lockfiles), `npm ls` oracle, robustness on hostile input, simplicity.
- **Convergence:** all three passed 9/9 and scored the same against `npm ls` (mocha 0.9953, npm-cli 0.9915; misses are `*-cjs` npm aliases plus packages `npm ls` reports as extraneous because the oracle's temp dir has no workspace `package.json` files). Strong agreement on shape: walk up the lockfile keys, follow links, BFS for depth.
- **Base: A.** Mirrors npm arborist's dependency-type precedence (peer → prod → optional → dev, later wins), uses a `Map` (no prototype-key lookups), skips non-object entries, and has the clearest BFS.
- **Grafted from B:** workspaces exist only when the root declares `workspaces` (A and C flagged mocha's `file:` dependency as a workspace); workspace entries take their real name from the `node_modules` link that points at them (npm omits `name` there, so A/C named `workspaces/arborist` "arborist" instead of `@npmcli/arborist`). Dev deps still install for every folder outside `node_modules` (root, workspaces, `file:` targets).
- **Rejected:** B's Map-iterator-as-queue BFS (correct but clever), B's per-group edge emission (duplicate edges when a name is listed under two types), C's plain-object lookups (`packages[resolved]` can hit prototype members on hostile input), C's `devOptional → dev` mapping (kept A's literal `dev` flag; revisit if dev badges look wrong).
- **Cross-judge (Haiku, read-only):** A 4/4/4/4, B 2/2/3/4, C 3/3/4/4 (correctness/security/simplicity/perf). Agreed on base A and on both B grafts; added C's header comment. It hand-traced bugs the suite missed: B crashes on a `null` entry or a numeric spec and duplicates prod+optional edges; C makes a phantom edge for a link resolving to `constructor` and mangles `npm:@s/x`. All are now regression tests that the merged parser passes.
- **Known ceiling:** resolution rebuilds key strings per ancestor (O(depth × key length)); fine at 5 ms for 1.1 MB, cache per folder if hostile nesting ever matters.
- **Verification after merge:** 11 parser tests + 7 security tests pass, `tsc --noEmit` clean, oracle unchanged (0.9953 / 0.9915).
