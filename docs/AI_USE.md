# AI use in Patient Zero

## Building it

Patient Zero was built with Claude Code (Anthropic) as a coding assistant, under the author's direction, who set the design, the security rules (S1 to S13) and every scope cut, and reviewed every Cypher query before it shipped. For the lockfile parser, the `ADMITS` window and the claims guard, competing implementations were generated, tested and judged; the picks are in `docs/decisions.md`.

## At runtime

LLMs on free tiers (Groq `qwen/qwen3.8-27b`, then Groq `gpt-oss-120b`, then Gemini `3.5-flash-lite`) do two things:

1. **Pick one analyst observation.** After a triage, the server builds three to six observations from the graph results (the carrier dependency, the production share, the advisory gap). The model answers with the id of the one most worth acting on. It chooses; it does not write.
2. **Handle open-ended Ask questions.** A question the server cannot classify goes to a bounded tool loop (4 model calls, 6 graph tool calls). The model picks read-only graph tools and composes a reply from their rows; the claims guard checks every repo, `name@version`, count and `[E#]` citation against the tool results.

Everything else is deterministic. The LLM never:

- writes the verdict, the "why", the notify list or the fix steps;
- decides a tier (`LOCKED`, `WOULD_PULL`, `MAINTAINER`, `CLEAN` come from Cypher);
- answers list and filter questions, a named repo's plan, rotate-secrets or `npm ci` questions, who to notify, or when it started (server-built answers, server-chosen tool calls);
- parses the alert (`find_target` is an indexed term lookup);
- writes or runs Cypher.

With no model at all, the triage is complete. Without a live model, the recorded pick for that clock is replayed and labelled. Every fact on screen comes from a Cypher query you can open on its card.
