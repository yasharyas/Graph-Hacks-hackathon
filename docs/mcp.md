# Patient Zero over MCP

`server/mcp.ts` is a local, stdio-only, read-only MCP server (S13). It exposes the triage tools (`find_target`, `suspect_versions`, `incident_exposure`, `filter_exposures`, `maintainer_blast_radius`, `explain_path`, `route_owners`, `concentration_risk`, `draft_remediation`, `scanner_view`) so the model picks the tool. Every call takes a required `scenario` (`qix-2025-09-08` or `axios-2026-03-31`), runs `GRAPH.RO_QUERY` on that Acme graph only, and returns the summary, rows and the exact Cypher. No raw-Cypher tool, no writes; `recall_triage` stays session-scoped and is not exposed.

Needs Node 24+, a running FalkorDB with `pz_acme_qix` / `pz_acme_axios` built (`npm run build:graph`), and `npm install`.

**Claude Code**

    claude mcp add --env FALKOR_PORT=6380 --env REDIS_PASSWORD=devpass patient-zero -- node /path/to/patient-zero/server/mcp.ts

**Claude Desktop** (`claude_desktop_config.json`)

    { "mcpServers": { "patient-zero": { "command": "node", "args": ["/path/to/patient-zero/server/mcp.ts"],
      "env": { "FALKOR_PORT": "6380", "REDIS_PASSWORD": "devpass" } } } }

**Try**

1. "Which repos would have pulled the qix malware at 13:30 UTC on 2025-09-08, and through which path?" (`incident_exposure`, then `explain_path`)
2. "Who should I tell about it, and what overrides should acme/checkout-web pin?" (`route_owners`, `draft_remediation`)
3. "Which maintainer is the next likeliest account takeover, and how many repos does it reach?" (`concentration_risk`, `maintainer_blast_radius`)
