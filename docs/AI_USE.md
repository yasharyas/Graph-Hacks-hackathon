# AI use in Patient Zero

## Building it

Patient Zero was built with Claude Code (Anthropic) as a coding assistant, under the author's direction, who set the design, the security rules (S1 to S13) and every scope cut, and reviewed every Cypher query before it shipped. For the lockfile parser, the `ADMITS` window and the claims guard, competing implementations were generated, tested and judged; the picks are in `docs/decisions.md`.

AI agents also did the following:

- **Persona QA.** AI agents role-played six testers against the running app over seven rounds: a FalkorDB judge, an on-call AppSec engineer, an OSS maintainer, a keyboard-only user, a phone user and a design reviewer. Their reports are `qa/reports/phase3*.md`. The judge win audit, `qa/reports/win-audit.md`, came from three AI auditors (Opus, Sonnet and Fable) and a Sonnet cross-judge.
- **Security reviews.** Claude Opus reviewed the code read-only against S1 to S13, and probed the running app. It ran the Phase 1 gate (findings in `docs/decisions.md`), the Phase 3 gate (`qa/reports/phase3-security.md`) and rounds 3 to 6 (`qa/security/`). Claude Code made the fixes.
- **Docs and copy.** Claude Code drafted the README, everything in `docs/`, the blog draft, the video script, the launch posts, the submission copy (`docs/submission.md`) and the UI copy. The blog draft is written in the first person, for the author to edit and publish.
- **Demo video.** Three AI-drafted scripts (Opus, Sonnet, Fable) were scored by a Sonnet cross-judge and merged by Claude Code (`docs/decisions.md`, "Video script arena"). The voice-over uses **ElevenLabs AI voices** ("Voices: ElevenLabs (AI)" on the end card and in the description), the sound effects are ElevenLabs AI sound generation, and the music is synthesized locally from code (numpy), with no AI model. The video was assembled in Remotion by four Claude Code agents (pixel art, p5.brush, UI footage, sound) working to a shared contract. The pixel-art and p5.brush scenes are rendered from code. The UI footage is the real app in replay mode. The one line in the author's own voice, if it is in the cut, is recorded on the author's microphone, never synthesized.

## At runtime

LLMs on free tiers (Groq `qwen/qwen3.8-27b`, then Groq `gpt-oss-120b`, then Gemini `3.5-flash-lite`) do two things:

1. **Pick one analyst observation.** After a triage, the server builds up to four observations at a time from the graph results (the malicious version that reaches the most repos, a carrier dependency many repos' shortest paths share, the ranges repos declare themselves, the busiest team, a repo that would fetch several malicious versions). The ones the verdict already states (tier counts, the production split, the advisory gap) are not offered. The model answers with the id of the one most worth acting on. It chooses; it does not write.
2. **Handle open-ended Ask questions.** A question the server cannot classify goes to a bounded tool loop (4 model calls, 6 graph tool calls). The model picks read-only graph tools and composes a reply from their rows; the claims guard checks every repo, `name@version`, count and `[E#]` citation against the tool results.

Everything else is deterministic. The LLM never:

- writes the verdict, the "why", the notify list or the fix steps;
- decides a tier (`LOCKED`, `WOULD_PULL`, `MAINTAINER`, `CLEAN` come from Cypher);
- answers list and filter questions, a named repo's plan, rotate-secrets or `npm ci` questions, who to notify, or when it started (server-built answers, server-chosen tool calls);
- parses the alert (`find_target` is an indexed term lookup);
- writes or runs Cypher.

With no model at all, the triage is complete. Without a live model, the recorded pick for that clock is replayed and labelled. A replay is a recorded observation id, not prose: the words come from the fresh run's rows. Every fact on screen comes from a Cypher query you can open on its card.

## Decisions taken during the build (for the author to confirm and restate)

A factual list drawn from `docs/decisions.md` and the git log. Times are IST. It records what was decided, not who argued for it; the author should confirm each item and restate it in their own words.

- **2026-10-15, Phase 0: one `Dep` node per lockfile location.** Each node is keyed `repo|lockPath`, and `REQUIRES {range, kind}` edges mirror the lockfile tree. Shared `Version -> Version` edges were rejected because they invent paths that exist in no real lockfile. Sources: `docs/contracts.md`, and commit 4909731 (scaffold and contracts, 14:32).
- **2026-10-15: precomputed, time-windowed `ADMITS {range, fromT, toT}` edges.** Ingest works out when each declared range started and stopped resolving to a bad version, so "exposed at 13:30?" is a property filter on an edge. It was an arena of three implementations, judged by a Haiku cross-judge; base A, with the judge-found bugs as regression tests. Source: `docs/decisions.md`, "ADMITS window + safe version".
- **2026-10-15: the LLM narrates or picks, and never writes facts.** After the Phase 3 persona QA found wrong "verified" answers, the verdict, why, notify and do lines were built from the report instead of by the model. Source: `docs/decisions.md`, "QA fix round", "Narration split".
- **2026-10-15, 23:30: free text cut after QA.** Live runs kept finding notes that passed the entity guard but were wrong: "currently using", "the sole malicious version", "all 20 would fetch it". The free-text note and its regex checks were deleted, and the model now answers with one observation id. Sources: commit 24beaba ("Let the LLM pick facts, not write them"), and `docs/decisions.md`, "Analyst pick replaces the free-text note".
- **2026-10-15, Phase 0: the `WOULD_PULL` wording.** "Would have fetched on a fresh install", never "compromised", "uses" or "installed". A Flash-Lite narration had called mocha "currently using" the bad version, and `npm ci` from a committed lockfile was safe throughout. Sources: `docs/decisions.md`, Phase 0 spike S4; commit f3ca28c (14:47); and the wording rule in `docs/proof-points.md`.
- **2026-10-15: synthetic-only `LOCKED`.** No real repo in the set locked a malicious version, so `LOCKED` appears only on two badged synthetic repos, `acme/checkout-web` and `acme/billing-api`. The 20 real repos are read from lockfiles committed just before each incident. Sources: `docs/contracts.md` (tiers), and commit bb59561 (incident data and org snapshots, 14:32).
- **Scope cuts.** These are in the README Limits and Roadmap:
  - npm `package-lock.json` v2/v3 only: no yarn, pnpm or PyPI
  - two incidents ingested
  - public repos and pasted lockfiles only: no GitHub App for private repos
  - no registry watcher
  - Slack notices and fix PRs are drafts: nothing is sent
  - no text-to-Cypher
  - MCP is stdio-only and read-only

  On 2026-10-16 the win audit also listed what not to build before the freeze: real Slack sends or GitHub PRs, text-to-Cypher in Ask, a third incident, and entering Tracks 2 or 3. Source: `qa/reports/win-audit.md`, "Not worth doing".
- **2026-10-15: the 13 security rules.** They are:
  - S1 validate all input
  - S2 no SSRF
  - S3 no Cypher injection
  - S4 prompt-injection defence
  - S5 no XSS, with a strict CSP
  - S6 secrets
  - S7 abuse and DoS limits
  - S8 hardened infra, with the read-only ACL user `pz_ro` and the write user `pz_rw`
  - S9 our own supply chain
  - S10 session-scoped write endpoints
  - S11 privacy (no emails stored)
  - S12 generic errors
  - S13 MCP stdio-only and read-only

  The security baseline was in commit 4909731 (14:32). The Phase 1 gate's fixes were in commit 87713e0 (15:36). Sources: `docs/decisions.md`, "Security gate after Phase 1", and the S1 to S13 table in `qa/security/phase3r6-security.md`.

**Build timeline.** The repo was created on 2026-10-15 at 14:23 IST. The Phase 0 history was rebuilt into 4 commits, all stamped 14:32:29 IST ("history rebuilt to 4 commits" in `docs/decisions.md`, Phase 0 gate). After that come normal commits, starting with f3ca28c at 14:47 IST.
