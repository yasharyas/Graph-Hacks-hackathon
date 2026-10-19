# Patient Zero demo video: "The Record and the Moment"

**Runtime:** 2:22.6 (142.6 s, 4,277 frames at 30 fps), hard cap 2:30. The output is 1920x1080 at 30 fps, with captions burned in and exported as an `.srt` file.

**The idea.** One time axis travels through three looks: 74 pixel cells in the hook, a hand-drawn rail in the explanation, and the real scrubber in the product. The resolution rises as the video goes: blocks, then pen, then the working app. Two voices split what can be known:

- The **Ledger** reads the record: only words that are on screen at that moment.
- The **On-call** engineer acts and reasons.

The model never speaks.

**The curve.**

| Stage | Time | Look | What the viewer gets |
|---|---|---|---|
| Animate (hook) | 0:00–0:16 | Pixel art | A number, a hijacked package, an alarm, and advisory-based scanners with nothing |
| Explain | 0:16–0:45.6 | p5.brush | The on-call question, one repo's range against its lockfile, and the graph model (one node per lockfile location, a time window on an edge) |
| Show | 0:45.6–2:09 | Real UI | Triage, path and plan, fix and write-back, PageRank and Ask, axios, MCP, paste a repo |
| Land | 2:09–2:22.6 | UI + brush, then the end card | 14:26 against the alarm, links, disclosures |

- **Problem understood by:** 0:14.3 (the end of LG-03).
- **Real UI first seen at:** 0:45.6. It fills about 59% of the runtime.

This was settled by an arena of three candidate scripts (Opus, Sonnet and Fable) and a cross-judge on 2026-10-16; see `docs/decisions.md`. Every number below is in `docs/proof-points.md`, or is a string measured on the production build (the strings and steps in "Recording notes" at the end).

---

## Cast (ElevenLabs `eleven_v4`, by voice_id)

| Key | Role | Voice | voice_id | Why | Delivery |
|---|---|---|---|---|---|
| `ledger` | **The record.** Reads timestamps and strings that are on screen at that moment, never a word that is not there. | Alice, "Clear, Engaging Educator" (British, female) | `Xb7hH8MSUJpSbSDYk0k2` | Clear on numbers and times, and it reads like a log. Two of the three arena scripts independently cast her as the narrator. | `[deadpan]` on LG-01 only, high stability (about 0.8). Falling sentence ends, never stresses an adjective. **A/B:** Daniel `onwK4e9ZLuTAKqWW03F9` |
| `oncall` | **The moment.** The on-call engineer: first person, every click, every judgement. Stands in for the author. | Viraj (Indian, young male, conversational) | `fPIfC3elMLbN9tNwMXkw` | Sounds like the person who would run this screen, and contrasts with Alice in gender, accent and register within one word. Two of the three scripts independently cast this voice as the engineer. | `[calm]` on OC-01 only, stability about 0.55. Level sentence ends. Clicks land on the verb. **A/B:** Roger `CwhRBWXzGAHq8TQ4Fs17` |
| `author` | **Optional.** One line only a human can stand behind (Rules 12 and 13). | The author's own microphone only. The author's ElevenLabs voice clone is never used. | n/a | A judge hears the person who can explain the queries. | Natural, unhurried |

**The casting rule a viewer can hear:**
- A flat British voice reading a number means the number is on the page.
- The other voice is a person acting.
- No line puts a verdict in a model's mouth.
- If the author line is not recorded in the author's own voice, it is **dropped**, not given to an AI voice. The end card carries the same words as text.

**Audition, 2026-10-16** (`eleven_v4`, edge silence trimmed): Alice reads at about 128 wpm, Viraj at about 149 and Roger at about 143. Run the Ledger at a pipeline tempo of 1.06 (a per-speaker `VO_TEMPO`), so Alice lands near 135 wpm. At these rates the VO fills about 89% of the runtime, so the trim order in "Word budget" applies.

Tags in use (v2, 2026-10-19: the author asked for emotion): `[dramatic]`, `[serious]`, `[ominous]`, `[tense]`, `[urgent]`, `[curious]`, `[excited]`, `[confident]`, `[determined]`, `[impressed]`, `[relieved]`, `[satisfied]`, `[triumphant]`, `[whispers]`, `[sighs]`, `[warm]`; each was checked with Scribe to be performed, not read out (`[sighs]` is a real sigh). **Never `[clear]`** (it produced "[clears throat]"). If Scribe QA hears a tag spoken, delete the tag and rely on the stability setting.

---

## Style map

| Segment | Time | Look | Why this look carries this meaning |
|---|---|---|---|
| H1–H2: the record | 0:00–0:16 | **Pixel art** (480x270 logical, x4, the product's own token palette) | The registry moves in whole minutes and does not care: 74 minutes become 74 cells you can count. No human and no UI: the world as it ran. |
| E1–E3: the notebook | 0:16–0:45.6 | **p5.brush** sheets (pen and marker strokes, typeset words) | Judgement is a human act. The app's scribbles are "an analyst's marker on a printout", and routes and time windows are things you draw. |
| U1–U4 | 0:45.6–1:40.5 | **Real UI** (production build, replay mode) | The proof |
| U5a: the axios card | 1:40.5–1:47.7 | **Pixel art** (same engine, new data) | The record replaying. A 106-cell bar against 74 says it without a sentence. |
| U5b–U7 | 1:47.7–2:09 | **Real UI** (terminal for U6) | The proof: second incident, MCP, paste |
| P1: payoff | 2:09–2:16.6 | **Real UI + one brush arrow** | The analyst's last mark, on the real thing |
| END | 2:16.6–2:22.6 | Typeset card + one brush underline | The signature |

**Brush over the UI** is limited to four named marks, and never more than two scribbles in view (counting the app's own):
- A1, U2: an amber underline under `^4.3.5`
- A2, U2: an `fg-0` loop round "Node By Index Scan (x:Dep)"
- A3, U3: an `fg-0` ring on the `recall_triage` line
- A4, U5b: a red underline under "106 minutes"
- plus the P1 arrow (`fg-0`)

**Red means infected** (design.md). Red ink is used only on the malicious version, the infection route and the two time-gap figures, matching the app's own red 74-min loop. Every other mark is `fg-0`, amber (ranges) or green (safe).

**Confinement:**
- Pixel art appears only in H1–H2 and U5a.
- p5.brush appears only in E1–E3, A1–A4, P1 and END.
- At a seam, both looks share the screen for at most 0.3 s.

---

## Seams (cut the curve)

**House direction is leftward.** The camera travels right along the timeline, so content leaves to the left. All seams follow `faceless-explainer/references/cut-catalog.md` §3:
- `power4.in` out and `power4.out` in, mirrored.
- 230 px each way, 0.30 s each.
- Exit opacity is gone by about 0.2 s; entry rises from 0.35 to 1.
- Partial travel only. Blur appears only on the two Z-axis moves.
- No bounce, back or elastic eases anywhere.
- Pixel layers snap to the 4 px grid after the ease is computed.

| Seam | At | From → to | Move | Hero (same direction on both sides) |
|---|---|---|---|---|
| S1 | 0:16 | pixel → brush | cut-the-curve **leftward**, plus a **mosaic resolve**: the entering sheet is drawn through 12 → 6 → 3 → 2 → 1 px blocks over its 0.3 s deceleration | The time axis. The 74-cell bar exits left, and the brush rail enters at the same y. Resolution rises across the cut. |
| S1a, S1b | 0:26, 0:36.1 | sheet → sheet | cut-the-curve **leftward** | The rail |
| S2 | 0:45.6 | brush → UI | cut-the-curve **leftward** | The hand-drawn 13:30 tick exits left. The UI enters with the scrubber handle at 14:30, then Shift+Left ×6 steps it left onto 13:30, so the handle keeps moving the same way after the cut. |
| S3 | 1:40.5 | UI → pixel | cut-the-curve **leftward** | The scrubber track becomes the 106-cell bar at the same y |
| S4 | 1:47.7 | pixel → UI | cut-the-curve **leftward**, plus the same mosaic resolve (block 8 → 1) | The bar becomes the axios scrubber track |
| S5, S6 | 1:53.7, 2:00.2 | UI → terminal → UI | cut-the-curve **leftward** | The tool-card column becomes the tool-call lines, then the paste sheet's input row |
| S7 | 2:09 | paste result → landing | cut-the-curve **upward** (a new axis for "back to the start") | The result headline rises out and the landing hero rises in |
| S8 | 2:16.6 | landing → end card | **inverse zoom-through** (arrival) | The UI recedes 1.0 → 0.8 while blur goes 0 → 18 px and opacity falls to 0.15 (0.2 s, `power3.in`); hard cut; the card arrives from 1.25 with 18 px blur, settling to 1.0, no blur and full opacity over 0.5 s on `expo.out`. Same peak blur on both sides. |

**Inside the UI:**
- U1–U4 is one continuous take with no seams. Hidden waits (a re-run, the paste fetch, Claude Code thinking) are cursor-matched cuts with a 4-frame crossfade, never sped up.
- Punch-ins are one quick move (0.5 s, `power3.out`) and then a still hold, at most 1.25x. No slow pushes or drift in a beat's back half.

---

## Beats

Each beat gives the screen, the clicks and the lines. The lines themselves (text, cue words and captions) live in the line list below, which is what the pipeline reads. Cue words are the forced-alignment tokens that trigger an action. **If a beat runs long, trim the VO, never the on-screen action.**

| # | Time | Dur | Look | Lines | Out |
|---|---|---|---|---|---|
| H1 | 0:00–0:08.8 | 8.8 | Pixel | LG-01, LG-02 | continuous |
| H2 | 0:08.8–0:16 | 7.3 | Pixel | LG-03 | S1 |
| E1 | 0:16–0:26 | 10.0 | Brush | OC-01, OC-02 | S1a |
| E2 | 0:26–0:36.1 | 10.1 | Brush | OC-03 | S1b |
| E3 | 0:36.1–0:45.6 | 9.5 | Brush | OC-04 | S2 |
| U1 | 0:45.6–1:03.5 | 17.8 | UI | LG-04, OC-05, LG-05 | continuous |
| U2 | 1:03.5–1:14.5 | 11.0 | UI + A1, A2 | LG-06, OC-06 | continuous |
| U3 | 1:14.5–1:28.1 | 13.6 | UI + A3 | OC-07, OC-08 | continuous |
| U4 | 1:28.1–1:40.5 | 12.4 | UI | OC-09, OC-10 | S3 |
| U5 | 1:40.5–1:53.7 | 13.2 | Pixel 3.5 s, then UI + A4 | LG-07, OC-11 | S5 |
| U6 | 1:53.7–2:00.2 | 6.5 | Terminal | OC-12 | S6 |
| U7 | 2:00.2–2:09 | 8.9 | UI | OC-13, LG-08 | S7 |
| P1 | 2:09–2:16.6 | 7.5 | UI + brush arrow | LG-09, OC-14 | S8 |
| END | 2:16.6–2:22.6 | 6.0 | Card + brush underline | AU-01 (optional) | end |

The sum is 142.6 s.

### H1 · 0:00–0:08.8 · Pixel · "74"

- **Frame 0 is the thumbnail.** On black:
  - "74" in 5x7 bitmap numerals (`#ECEAE6`, x6 logical), with "MIN" beneath in `#85837E`.
  - `2025-09-08 UTC` in the top-left.
- **At 2.0 s** the numerals step-shrink in 3 steps to the right end of a **74-cell bar**, whose outline draws left to right, 2 cells per step. The bar's left end is labelled `13:12` and its right end `14:26`.
- **Left:** the **qix** tile (16x16, a `#8C2A2A` disc with a `#FF5A4F` ring, the bitmap label "qix").
- **Right:** the **scanner** box (44x26) with a grey LED reading `0`.
- **Bottom:** a 7x3 grid of 21 repo tiles (`#5C9DFF` outlines, 16x10) under a bitmap label **`21 REPOS`**.
- **Cues:**
  - "minutes": the MIN row steps in.
  - "kicks": the qix ring flashes twice.
  - "hijacked": the ring fills red (6 frames).
  - "malicious": an 8x8 crate labelled "debug" appears above the tile.
  - "out": the crate drops onto cell 0, which fills red.
- **Audio:** music M1 starts on one low square-wave note, with a 3-note arpeggio from 2.4 s. SFX-01 ticks on each cell, and SFX-03 (the crate) lands on "out".

### H2 · 0:08.8–0:16 · Pixel · "The window"

- **During the line:**
  - Cells 0–4 fill under "Someone raised the alarm in four". A bell sprite rings above cell 4 on "four".
  - Cells 4–18 fill on "minutes".
  - At cell 18 a `13:30` flag pops, and on "Advisory-based" the 21 tiles light in three waves of 7: **20 amber** (`#E8A33D`) and **1 red** with a 3x3 white "S" pip (the badged sample repo).
  - The scanner LED stays at grey `0` and blinks once on "nothing".
- **After the line (silent):**
  - The bar races from 18 to 74 in 0.9 s (14 ticks, rising in pitch).
  - About 1 s after the line ends, the stamp `14:26 OSV` drops on cell 74. The LED ticks to `1`, with a 1 px red line to **the red tile only**: the scanner never reaches the 20.
  - "74 MIN" returns at x6. Hold 0.5 s, then S1.
- **Audio:** SFX-02 (the bell), a SFX-01 tick roll through the ramp, and SFX-04 (the stinger) on the stamp. M1 rises through the ramp to the stamp, then holds and stops hard at S1. OC-01 starts at 0:13.6 over the pixel exit (a J-cut).

### E1 · 0:16–0:26 · Brush · "13:30, on call"

- **The sheet:** paper `#121214`, no texture.
  - A pen **rail** at the pixel bar's y, with a tick and the typeset label `13:30 UTC` (Martian Mono 28 px).
  - Left: typeset `Advisory scanner` (Satoshi 500) over a large grey `0` (Satoshi 700).
  - Three typeset questions appear one per cue, each led by a hand-drawn checkbox.
  - A chyron, bottom-left (Satoshi 500, `fg-2`): "Triage layer, not a detector".
  - The right half stays empty.
- **Cues:**
  - "Thirteen thirty": the rail and tick draw.
  - "zero": an `fg-0` pen ring round the 0. Not red: the scanner is not infected.
  - "repos", "what", "page": boxes 1–3 and their questions.
- **Audio:** music M2 (felt piano and warm pad, no drums) fades in under the J-cut. SFX-05 (pen circle) and SFX-06 (pen line per checkbox).

### E2 · 0:26–0:36.1 · Brush · "One range, one fetch"

The same rail continues on a new sheet. Nodes use the app's graph legend, so the real path graph reads at a glance in U1:
- **mocha** is a pen-drawn blue rounded square (`#5C9DFF`) labelled `mochajs/mocha`.
- A pen line labelled "declares" runs to the chip `debug ^4.3.5`, with the range in amber.
- A short pen line labelled "pins" runs down to `debug@4.3.5` (neutral), with a lock doodle, a green `#5BBE8A` check and "npm ci: safe".
- From the range chip, a **dashed amber marker arrow** runs to **`debug@4.4.2`**, drawn as the legend's red dot with a red ring.
- On "fetched", the amber **`WOULD_PULL`** chip (Martian Mono, amber on `#30261A`) lands on the arrow, with the plain line "a fresh install in the window would have fetched it" (Satoshi, `fg-0`).

**Cues:**
- "mocha": the square and its label.
- "itself": the "declares" line and range chip.
- "pins": the pin chip and lock.
- The second "safe": the check.
- "fetched": the arrow draws and the chip lands.
- "malicious": the red dot and ring.

**Audio:** SFX-06 per stroke and SFX-07 (marker dash) on "fetched".

### E3 · 0:36.1–0:45.6 · Brush · "A window on an edge"

- **The sheet:** the rail is now a time axis with typeset ticks `13:12`, `13:30` and `14:26`.
  - An amber marker **bracket** runs from 13:12 to the open right end, labelled `ADMITS {range, fromT, toT}` (Martian Mono, amber).
  - Below it, a small lockfile tree in chips:
    - root `mochajs/mocha`, with `node_modules/debug` under it
    - in faded dashed pencil, a nested `node_modules/needle/node_modules/debug` (mocha's real second copy, `debug@3.2.7`)
  - Beside the tree (Satoshi 500, `fg-1`): "one node per lockfile location".
  - On "filter", a vertical pen line drops at 13:30 and the marker highlights the bracket's span up to it.
  - After the line, a **red marker path** draws root → `debug ^4.3.5` in silence: zero hops, the shortest path.
- **Cues:**
  - "location": the tree chips.
  - "window": the bracket and its label.
  - "filter": the 13:30 line and the highlight.
- **Audio:** SFX-07 on the bracket and SFX-06 on the vertical line. M2 lifts one step on "window".

### U1 · 0:45.6–1:03.5 · UI · "Run triage"

**Take A, continued from the fresh load.** The autoplay has finished, and the cursor is on the scrubber handle ("Scenario time, UTC").

1. **In the first 1.2 s,** press **Shift+Left ×6** (14:30 → 13:30). The button must read **Run triage at 13:30 UTC**.
   - The hero reads "21 repos one install from malware, 20 safe with npm ci" · "Advisory scanner 0" · "Patient Zero 1 LOCKED · 20 WOULD_PULL".
   - The app's own `contrast-arrow` draws.
2. **On "Run",** click **Run triage at 13:30 UTC**. The cards stream in:
   - `suspect_versions`, `incident_exposure`, `maintainer_blast_radius`, `recall_triage`, then `explain_path` per repo
   - each card shows its ms figure, with "cached" visible; the header chip reads "LLM replay"
3. **The status line** reads "Triage complete: 49 tools, 62 of 62 claims traced to graph queries". With no click, the screen also shows:
   - "Analyst pick · LLM replayed: 4 repos' shortest paths to a malicious version run through the same dependency, @babel/core …"
   - "Notify 7 teams"

**Cues:**
- "Twenty-one": a punch-in on the hero band.
- "Run": the click.
- "Forty-nine": the feed.
- "I-D": a flat `fg-0` callout box beside the "LLM replay" chip, reading **"replay: a recorded pick, rebuilt from this run's rows"**. This is typeset, not brush: it is the honesty device for replay mode.
- "Sixty-two" (LG-05): the cursor moves to the status line.

**Audio:**
- SFX-10 key clicks ×6, each 1 dB lower than the last.
- SFX-11 click on Run.
- SFX-12 tick on the first six cards only.
- Music M3 (a dry soft pulse, muted bass, a glassy tick, 90 bpm) enters at S2.

### U2 · 1:03.5–1:14.5 · UI + A1, A2 · "A path and its plan"

1. Click the **`mochajs/mocha`** row. It reads "^4.3.5 debug@4.4.2 · direct · declared directly by the repo", and the path graph draws the chain.
2. Open "Show 2 more evidence paths …", then click **`[E3]`**. The `explain_path · mochajs/mocha` card opens ("range ^4.3.5 admits it · declared by the repo") with its Cypher.
3. Click **Show plan** inside the card. The `GRAPH.EXPLAIN` block ends in "Node By Index Scan (x:Dep)" under "Conditional Traverse (x)-[e:RESOLVES_TO|:ADMITS]->(@anon_2:Version)".

**Cues:**
- "Range": A1, the amber underline under `^4.3.5`.
- "Zero": the chain highlights.
- "Cypher": the cursor moves to the Cypher block.
- "explain": the Show plan click.
- "plan": A2, the `fg-0` loop round "Node By Index Scan (x:Dep)". A1 has faded by then.

**Backup** if mocha's row is off screen: `github/docs` (`chalk ^5.0.1`, `[E2]`); the VO stays the same.

### U3 · 1:14.5–1:28.1 · UI + A3 · "Fix, Notice, write-back"

1. On "Fix", click **Fix** (the ghost button at the end of the mocha row). The drawer opens on the Fix tab:
   - "The malicious versions are still on npm: keep installing from your committed lockfile (npm ci) …"
   - the package.json block with `"debug@4.4.2": "4.4.1"`
2. On "Notice", click the **Notice** tab: "For QA in #team-qa (demo team; draft only, nothing is sent)".
3. On "mark", click **Mark remediated** in the drawer's bottom bar. The bar reads "Remediated · <date>, <time> UTC · Undo".
4. On "graph", press **Esc**, then click **Run again** in the band above the panes; cut the wait. The new `recall_triage` card reads "21 repos assessed earlier in this session; 1 marked remediated: mochajs/mocha".
   - On "back": A3, an `fg-0` ring on that line.

**Audio:** SFX-11 clicks, and a single warm swell on "back" (an M3 stem lift of +2 dB for 1 s).

### U4 · 1:28.1–1:40.5 · UI · "The next qix, and Ask"

1. Open the **Graph stats** tab for 1.3 s, with no VO and one SFX-12 tick. It reads "pz_acme_qix · 46,810 nodes · 123,426 edges · Dep 27,349 · Version 10,210 · Package 5,373 · Maintainer 3,817 · Advisory 30". **It must come before axios and the paste**, because it describes the run on screen.
2. On "next", click the "Next qix? sindresorhus …" line, which opens **Concentration**: "sindresorhus 43% · 307 packages · reaches 21 of 21 repos", "ljharb 29% · 183 packages · reaches 20 of 21 repos", "types 29%".
3. On "If", click the Ask box (its placeholder reads "If ljharb were hijacked next, which repos would it reach?") and type that question at about 30 characters a second. Press **Ask** on "twenty".
   - Expect a `maintainer_blast_radius` card: ljharb's packages reach 20 repos, all but the synthetic `acme/checkout-web`.

**Backup:** ask "which exposures are prod-only and who owns them?". It reads "Complete list (prod only): 14 repos across 6 teams". Swap OC-10 for OC-10b.

### U5 · 1:40.5–1:53.7 · Pixel card 3.5 s, then UI + A4 · "axios"

**U5a (pixel, 1:40.5–1:47.7).** The same engine and layout as H1–H2, with new data:
- labels `00:21` (first malicious publish) and `02:07` (the campaign's first OSV record), dated `2026-03-31`
- a crate labelled `axios`
- a **106-cell** bar at the same 4 px pitch: the longer bar is the point. It ramps from 0 to 106 in 1.0 s on "hundred".
- the stamp `02:07 OSV` drops, and "106 MIN" shows for 0.4 s
- no repo tiles in this card

**U5b (UI, from 1:47.7).** S4 resolves in.
1. Click the **axios · Mar 2026** radio in the header. The triage re-runs at 01:30 UTC on 2026-03-31; cut the wait. The screen reads "Triage complete: 27 tools", and the hero reads "10 repos one install from malware, 9 safe with npm ci".
2. On "tilde", click the **`louislam/uptime-kuma`** row: "~0.30.3 axios@0.30.4 · direct · declared directly by the repo".
3. On "malicious": A4, a red underline under "106 minutes" in the verdict "In hindsight: it came at 02:07 UTC, 106 minutes after the first exposure".

Do not say a vendor was first on this incident: the first OSV record (02:07) came before the first vendor alert (02:19).

### U6 · 1:53.7–2:00.2 · Terminal · "MCP in Claude Code"

- **Before the take:** run `claude mcp add --env FALKOR_PORT=6380 --env REDIS_PASSWORD=devpass patient-zero -- node /path/to/patient-zero/server/mcp.ts` and crop the env values off screen.
- **Terminal font:** Martian Mono.
- **Prompt:** "Which repos would have pulled the qix malware at 13:30 UTC on 2025-09-08, and through which path?"
- **Tool calls:** `incident_exposure`, then `explain_path`, each with its rows and "Cypher (GRAPH.RO_QUERY on pz_acme_qix)". Retake until both show. Cut the waits; don't speed them up.

### U7 · 2:00.2–2:09 · UI · "Paste a repo"

1. **Off camera:** click **qix · Sept 2025** and cut the re-run. Warm `mochajs/mocha` once beforehand, and keep to one analysis per 20 s.
2. On "Paste", click **Paste your repo**, type `mochajs/mocha` in the GitHub repo field, and click **Analyze**.
3. The stages run (Fetch lockfile, Parse, Write graph, Enrich, Check ranges); cut the waits. The triage then runs by itself:
   - "Triage complete: 9 tools"
   - "1 repo one install from malware, npm ci is safe"
   - the verdict opens with "Judged on the package-lock.json at commit 5f8e8a8 from 2025-09-01, the last change before the incident"

**Cues:**
- "graph": the Write graph stage.
- "incident": the "Judged on" line.
- LG-08: the status line.

### P1 · 2:09–2:16.6 · UI + brush arrow · "Before the advisory"

- **Take E:** a fresh landing with the autoplay finished and the handle at 14:30.
  - The app's own `seventy-four-min` scribble circles "74 min · before the OSV record existed". If it does not persist, composite the PNG pair from `web/public/scribbles/`.
  - The timeline marks read "13:12 exposed · 13:16 alert · 14:26 OSV record · 15:15 removed".
- **The new brush mark:** one `fg-0` arrow drawn **leftward**, from the `14:26 OSV record` mark to the `13:16 alert` mark. It counts as the second scribble in view.
- **Do not scrub to 13:30 for this shot:** the `contrast-arrow` would make a third scribble.
- **Cues:**
  - "fourteen twenty-six": the arrow starts.
  - "alarm": the arrowhead lands on 13:16.
- **Audio:** SFX-06 for the arrow. M3 thins to the pad, and M4 starts 2 s before the end card.

### END · 2:16.6–2:22.6 · End card

Everything is left-aligned on `#0A0A0B`; only the "74 min" figure is ever centred.

- **"Patient Zero"** in Cabinet Grotesk 800.
- **"Exposed before the advisory exists."** in Satoshi 500, with a hand-drawn red underline (`end-underline`, a 500 ms wipe 0.8 s into the card).
- "FalkorDB Graph Hacks · Track 1: Agents That Act on Connected Data"
- `patient-zero-rayp.onrender.com` · `github.com/yasharyas/Graph-Hacks-hackathon` (Martian Mono)
- "MIT · $0 to run · a triage layer, not a detector"
- **Disclosure** at **24 px or larger**, in `fg-1`, on screen for the whole card (at least 4 s): **"Voices: ElevenLabs (AI) · Built with Claude Code under the author's direction · docs/AI_USE.md"**

**Cues:**
- "Claude" (AU-01): the AI-use line underlines.
- The disclosure brightens at 1.4 s. (The spoken "Voices: ElevenLabs, A-I." line was cut at the author's request on 2026-10-19; the written disclosure stays on the card.)

**Audio:** SFX-13 end tone on the title. M4 resolves on an open fifth, and its tail ends 1 s after the last frame.

**With no author line,** nothing moves: the card text says it and the music fills.

---

## Line list (the pipeline reads this)

- `tts` is sent to `eleven_v4`, with the respellings below.
- `cap` is the burned-in caption, with the real spelling.
- `cues` maps alignment tokens to actions.
- The caption for each line is its `cap`: two lines of up to 46 characters, Satoshi 500 at 40 px, bottom third, on an `rgb(10 10 11 / .72)` scrim. Code and tier names are in Martian Mono. Move a caption to the top of the frame when the action is low.

```json
[
{"id":"LG-01","speaker":"ledger","beat":"H1","tts":"[dramatic] Seventy-four minutes.","cues":[["minutes","MIN row steps in"]],"cap":"74 minutes"},
{"id":"LG-02","speaker":"ledger","beat":"H1","tts":"[serious] The N-P-M account kicks was hijacked, [ominous] and a malicious debug release went out.","cues":[["kicks","qix ring double flash"],["hijacked","ring fills red"],["malicious","crate appears"],["out","crate drops on cell 0"]],"cap":"npm account qix hijacked · malicious debug release out"},
{"id":"LG-03","speaker":"ledger","beat":"H2","tts":"[tense] Someone raised the alarm in four minutes. [dramatic] Advisory-based scanners had nothing.","cues":[["four","bell at cell 4"],["minutes","cells 4 to 18"],["Advisory-based","13:30 flag, 21 tiles light"],["nothing","scanner LED blinks"]],"cap":"13:16 first alarm · 13:30: 21 repos, 20 would pull · scanner 0 until 14:26"},
{"id":"OC-01","speaker":"oncall","beat":"E1","tts":"[tense] Thirteen thirty. I'm on call, and the scanner says zero. [sighs] It isn't wrong.","cues":[["Thirteen","rail and 13:30 tick"],["zero","fg-0 ring on the 0"]],"cap":"13:30 UTC · I'm on call · scanner: 0, and it isn't wrong"},
{"id":"OC-02","speaker":"oncall","beat":"E1","tts":"[urgent] Which repos does this reach, through what, and who do I page?","cues":[["repos","box 1"],["what","box 2"],["page","box 3"]],"cap":"Which repos? Through what? Who do I page?"},
{"id":"OC-03","speaker":"oncall","beat":"E2","tts":"[curious] mocha declares debug itself. Its lockfile pins a safe version, so N-P-M C-I was safe. [serious] A fresh install would have fetched the malicious one.","cues":[["mocha","repo square"],["itself","declares line, range chip"],["pins","pin chip, lock"],["safe","green check (second occurrence)"],["fetched","dashed arrow, WOULD_PULL chip"],["malicious","red dot and ring"]],"cap":"mocha declares debug ^4.3.5 · npm ci was safe · a fresh install would have fetched it"},
{"id":"OC-04","speaker":"oncall","beat":"E3","tts":"[excited] Falkor DB makes each lockfile location a node, and each range an edge with a time window. [confident] Exposed at thirteen thirty: a filter.","cues":[["location","tree chips"],["window","ADMITS bracket"],["filter","13:30 line, span highlight"]],"cap":"One node per lockfile location · ADMITS {range, fromT, toT} · exposed at 13:30 = a filter"},
{"id":"LG-04","speaker":"ledger","beat":"U1","tts":"[dramatic] Twenty-one repos one install from malware. [relieved] Twenty safe with N-P-M C-I.","cues":[["Twenty-one","punch-in on the hero band"]],"cap":"21 repos one install from malware · 20 safe with npm ci"},
{"id":"OC-05","speaker":"oncall","beat":"U1","tts":"[determined] Run triage. [excited] Forty-nine read-only graph calls. [confident] A model only picks an observation, by I-D.","cues":[["Run","click Run triage"],["Forty-nine","feed"],["I-D","replay callout"]],"cap":"49 read-only graph calls · a model only picks an observation id"},
{"id":"LG-05","speaker":"ledger","beat":"U1","tts":"[impressed] Sixty-two of sixty-two claims traced.","cues":[["Sixty-two","cursor to status line"]],"cap":"Triage complete: 49 tools, 62 of 62 claims traced"},
{"id":"LG-06","speaker":"ledger","beat":"U2","tts":"[serious] Range admits it. Declared by the repo.","cues":[["Range","A1 amber underline"]],"cap":"range ^4.3.5 admits it · declared by the repo"},
{"id":"OC-06","speaker":"oncall","beat":"U2","tts":"[confident] Zero hops, a shortest path from the root. [excited] Every card carries its Cypher, and graph explain shows the plan.","cues":[["Zero","chain highlight"],["Cypher","cursor on Cypher block"],["explain","click Show plan"],["plan","A2 loop on the index scan"]],"cap":"0 hops · shortestPath from the lockfile root · Cypher and GRAPH.EXPLAIN on every card"},
{"id":"OC-07","speaker":"oncall","beat":"U3","tts":"[confident] Fix drafts the pin and the pull request. Notice drafts the Slack message. [whispers] Nothing is sent.","cues":[["Fix","click Fix"],["Notice","click Notice tab"],["sent","draft-only line"]],"cap":"Fix and Notice are drafts · nothing is sent"},
{"id":"OC-08","speaker":"oncall","beat":"U3","tts":"[satisfied] I mark mocha remediated. [excited] That's written to the graph, and the next run reads it back.","cues":[["mark","click Mark remediated"],["graph","Esc, Run again"],["back","A3 ring on recall_triage"]],"cap":"Mark remediated → written to the graph → read back by recall_triage"},
{"id":"OC-09","speaker":"oncall","beat":"U4","tts":"[curious] Who could be the next kicks? Page rank ranks the accounts behind the most repos.","cues":[["next","click the Next qix line"],["accounts","Concentration rows"]],"cap":"PageRank: who could be the next qix?"},
{"id":"OC-10","speaker":"oncall","beat":"U4","tts":"[ominous] If L-J-harb were hijacked: [dramatic] twenty repos, answered from the graph.","cues":[["If","typing starts"],["twenty","press Ask, answer card"]],"cap":"If ljharb were hijacked: 20 repos · answered from the graph"},
{"id":"OC-10b","speaker":"oncall","beat":"U4","backup":true,"tts":"[curious] Which exposures are prod-only? [confident] Fourteen repos across six teams, answered from the graph.","cues":[["Which","typing starts"],["Fourteen","press Ask, answer card"]],"cap":"14 repos · 6 teams · answered from the graph"},
{"id":"LG-07","speaker":"ledger","beat":"U5","tts":"[dramatic] axios, March twenty twenty-six: one hundred six minutes to the campaign's first O-S-V record.","cues":[["axios","crate drops"],["hundred","bar ramps 0 to 106"],["record","02:07 OSV stamp"]],"cap":"axios, Mar 2026 · 106 min to the campaign's first OSV record"},
{"id":"OC-11","speaker":"oncall","beat":"U5","tts":"[serious] uptime kuma declares axios with a tilde range, and that admits the malicious release.","cues":[["uptime","cursor to the row"],["tilde","click uptime-kuma row"],["malicious","A4 underline under 106 minutes"]],"cap":"~0.30.3 admits the malicious 0.30.4 · 27 tools"},
{"id":"OC-12","speaker":"oncall","beat":"U6","tts":"[excited] The same tools run over M-C-P, so Claude Code can call them and read the rows.","cues":[["M-C-P","prompt sent"],["Claude","first tool call"],["rows","rows highlight"]],"cap":"Same tools over MCP · 10 read-only tools"},
{"id":"OC-13","speaker":"oncall","beat":"U7","tts":"[confident] Paste a repo: its own graph by graph copy, its lockfile from before the incident.","cues":[["Paste","click Paste your repo"],["graph","Write graph stage"],["incident","Judged-on line"]],"cap":"Your repo: its own graph via GRAPH.COPY · lockfile from just before the incident"},
{"id":"LG-08","speaker":"ledger","beat":"U7","tts":"[satisfied] Triage complete. Nine tools.","cues":[["Nine","status line"]],"cap":"Triage complete: 9 tools · npm ci is safe"},
{"id":"LG-09","speaker":"ledger","beat":"P1","tts":"[dramatic] First advisory: fourteen twenty-six.","cues":[["fourteen","arrow starts at the 14:26 mark"]],"cap":"First OSV record: 14:26"},
{"id":"OC-14","speaker":"oncall","beat":"P1","tts":"[triumphant] The graph needed no advisory. Only the alarm.","cues":[["alarm","arrowhead lands on 13:16"]],"cap":"No advisory needed · only the alarm"},
{"id":"AU-01","speaker":"author","beat":"END","optional":true,"tts":"I built this with Claude Code. Every query is in the read-me, and I can explain each one.","cues":[["Claude","AI-use line underlines"]],"cap":"Built with Claude Code · every query is in the README"}
]
```

AU-01 is recorded on the author's own microphone and is never synthesized. OC-10b is a backup line and is synthesized only if the Ask take fails.

---

## Word budget and credits (measured, 2026-10-16)

The full voice-over pass is synthesized (`eleven_v4`), aligned and checked by Scribe. The take files and the timing data live in the video project (`C:\Users\Yash Arya\patient-zero-video`: `public/audio/vo/`, `src/data/timing.json`, `out/vo-draft.mp3`). The beat table above holds the measured durations, written back by `tools/sync_script.py`.

| | Words | ElevenLabs characters (with tags) |
|---|---|---|
| Ledger (LG-01–LG-10) | 74 | 512 |
| On-call (OC-01–OC-14) | 215 | 1,209 |
| Author (AU-01, own mic) | 18 | 0 |
| **Total spoken** | **307** | **1,721** (plus 88 for the OC-10b backup) |

- **Runtime:** 2:22.4 without the author line. If AU-01 is recorded, END grows by about 6.5 s, for a total of about 2:29.
- **Measured pace:** Alice runs about 128 wpm before the 1.06 tempo is applied; Viraj about 149 wpm.
- **Timing slack:** speech fills about 87% of the runtime. The rest is click pauses, the hook's silent ramp and the seams. Each beat lasts its lead + speech + gaps + hold (`tools/lines.py`), so a longer retake moves every later beat instead of overrunning.
- **Trim order** if a retake runs long: OC-01's "It isn't wrong" (it stays in the caption), then OC-07's "Nothing is sent" (it stays on screen).
- **Credits:** a full pass is 1,721 characters, and lines are cached by id. Used so far: 354 (audition) + 1,776 (first pass) + 220 (two rewrites, the FalkorDB A/B, one retake), about 2,350.

These counts are verified by script against the JSON above; see `docs/decisions.md`.

## Pronunciation

| Term | In `tts` | A/B | Note |
|---|---|---|---|
| qix | `kicks` | `Q-I-X` | Unverified; A/B on LG-02 first and use the same choice in OC-09. Captions and pixel labels always read `qix`. |
| FalkorDB | `Falkor DB` | `FalkorDB` | FAL-kor D-B. Scribe heard `FalkorDB` as "Falco DB" and `Falkor DB` as "FalcorDB" (2026-10-16), so `tts` uses the space; `Falkor D-B` lost the R. |
| npm, npm ci | `N-P-M`, `N-P-M C-I` | | |
| Cypher | `Cypher` | `cipher` | SY-fer |
| GRAPH.COPY, GRAPH.EXPLAIN | `graph copy`, `graph explain` | | |
| PageRank | `Page rank` | | |
| MCP, OSV, AI, id | `M-C-P`, `O-S-V`, `A-I`, `I-D` | | |
| ljharb | `L-J-harb` | `L J Harb` | |
| uptime-kuma | `uptime kuma` | `uptime KOO-ma` | |
| axios | `axios` | `ack-see-ohs` | |
| mocha | `mocha` | | MOH-kuh |
| README | `read-me` | | author line only |
| Versions and ranges | **not spoken** | | `debug@4.4.2`, `^4.3.5` and `~0.30.3` stay on screen; the VO says "a malicious debug release", "a tilde range" |
| Times | "thirteen thirty", "fourteen twenty-six" | | 24-hour, read as written |

---

## Production notes

### Pixel engine (H1, H2, U5a): about 4.5 h

- **Component:** one Remotion `<Pixel>` component.
  - It draws a 480x270 logical canvas each frame, scaled x4 with `imageSmoothingEnabled = false`.
  - Everything is a function of the frame index: no `Math.random`, no wall clock.
  - Sprites step at 15 fps (`frame >> 1`). Seams move at 30 fps, with positions snapped to the 4 px grid after easing.
- **Palette:** 11 product tokens, verbatim: `#0A0A0B` `#19191C` `#34343A` `#6C6C76` `#85837E` `#ECEAE6` `#FF5A4F` `#8C2A2A` `#E8A33D` `#5C9DFF` `#5BBE8A`.
  - The pixel-art skill's era palettes (NES, PICO-8) are not used: they bring purple and neon, which design.md bans.
  - The skill's lesson that does apply is nearest-neighbour only.
- **Bitmaps:**
  - A 5x7 font of about 30 glyphs: digits, `: . -`, and the letters in "qix debug axios MIN OSV REPOS UTC".
  - About 12 sprites: qix tile, crate, bell, scanner box with LED digits, repo tile in 4 states, flag, stamp, and the "74" and "106" numerals.
- **Cue binding:** the bar's cell index is piecewise linear, with knots at the alignment cues. It is a time-lapse: cells are minutes, and the pace is editorial.
- **Mosaic resolve (S1, S4):** render the entering layer to an offscreen canvas at 1/12, 1/6, 1/3 and 1/2 size, upscaling each step with smoothing off. It is one shared component, about 30 lines.

### p5.brush sheets and marks (E1–E3, A1–A4, P1, END): about 5 h

- **Tools:** p5 2.3.4 + p5.brush 2.2.3, exactly as in `design/scribbles/README.md`: instance mode, fixed seeds, `finish()` recolouring to token inks with a 1 px feather, and `lib.mjs` for bootstrap, snapshot and export.
  - Put one sketch per sheet in a **copy of the bench outside the repo**: its `/__export` writes to `web/public/scribbles/`, so move the files out and `git restore`.
- **Canvas:**
  - 960x540 at `pixelDensity(2)`, which gives 1920x1080 transparent PNGs.
  - `brush.scaleBrushes(4.8)` (the README's 480 px recipe, doubled).
  - `pen` at weight 1.2–1.6 for lines, boxes, rings and ticks; `marker` for the bracket, the dashed arrow and the red path.
- **Seeds:** E1 `1757338200` (13:30:00Z), E2 `1757337159` (13:12:39Z, the debug publish), E3 `1757341611` (14:26:51Z, the existing 74-min seed).
- **Words are typeset, marks are brushed.** All text is real type (Satoshi, Cabinet Grotesk, Martian Mono), placed in Remotion above the ink.
- **One PNG layer per stroke,** revealed in Remotion with the app's own technique:
  - a linear mask slid along the stroke for lines, underlines and arrows
  - a conic mask from the pen-down point for rings and loops
  - 300–900 ms, ease-out, on the cue word
  - split a stroke into two layers at a turn if it is not monotonic
  - no per-frame p5 and no stroke-polyline logging
  - fallback for one stubborn curve: a 15-frame PNG sequence from the same seed
- **Reused assets:** `seventy-four-min-arrow` and `seventy-four-min-loop` (inside the P1 footage, or composited from the PNG pair).
- **New small marks:** `ul-range` (amber), `plan-loop` (`fg-0`), `ring-recall` (`fg-0`), `ul-106` (red-400), `arrow-p1` (`fg-0`) and `end-underline` (red-400 at 85%).

### UI recording: about 2 h

- **Server:** the production build (`npm run build:web`), served with **`LLM_CHAIN=replay`** on `:8090` (launch config `patient-zero-replay`).
  - Before every take, check that the header chip reads **"LLM replay"**.
  - A take showing "LLM live" or "61 of 61" is wrong: the pick and the claim count change.
  - A pasted repo reads "LLM template", because a replay has no recorded pick for a repo pasted at record time.
- **Capture (recorded 2026-10-16):** `node tools/record_ui.mjs <take>` in the video project (`--dry` checks the selectors without recording).
  - It drives headless Chromium through each take's steps at 1440x900 and device scale 1.5, captured with the CDP screencast (2160x1350, JPEG q80).
  - Frames are held to a constant 30 fps and encoded as H.264 CRF 14 (`footage/<take>.mp4`).
  - The screencast ignores device-scale emulation on its own, so it is launched with `--force-device-scale-factor`.
  - Scale 2 dropped motion to about 20 fps; 1.5 keeps it near 30 (median frame gap about 35 ms).
  - The composite is 1728x1080, centred on `#0A0A0B`. 2160 px covers punch-ins up to **1.25x** at full sharpness, so no punch-in goes past 1.25x.
  - Headless Chromium draws no cursor. Every pointer position, click, key and wheel step is logged on the screencast's clock (`footage/<take>.events.json`, with per-frame times), and Remotion draws the cursor and click ripples from it.
- **Takes:**

| Take | Beat | Content | Length |
|---|---|---|---|
| A | U1–U4 | One continuous take from a fresh load | 61.5 s |
| B | U5b | axios. The qix triage runs off camera first, because the radio re-runs a triage only once one has run. | 11.5 s |
| C | U6 | The terminal. Recorded by the author; see "MCP (U6)". | |
| D | U7 | The paste | 12.4 s |
| E | P1 | A fresh landing with the autoplay finished | 20.1 s |

- The step-by-step states, keys and backups are in "Recording notes" below.

### Sound: about 2 h

- **Music:** ElevenLabs music if the key allows it; otherwise generate it locally, as in the earlier project's `make_music.py`, and change the disclosure to "Music: generated locally".
  - Mix about −28 dBFS under the VO, with 6–8 dB of sidechain ducking.
  - Master to −16 LUFS integrated, −1 dBTP.
  - The four cues:

| Stem | Time | Spec |
|---|---|---|
| M1 "Registry" | H1–H2 | Square and pulse waves, A minor, 96 bpm. One low note, an arpeggio from 2.4 s, a riser through the silent ramp, and a hard stop at S1 with a 1 s tail. |
| M2 "Notebook" | E1–E3 (from the J-cut) | Felt piano and warm pad, 72 bpm, no drums. Lifts one step in E3. |
| M3 "Instrument" | U1 to 2 s before END | A dry soft pulse, muted bass and a glassy tick, 90 bpm. Dips under the axios card; swells on "back". |
| M4 "Resolve" | the last 2 s of P1 to the end | One open fifth |

- **SFX** (`eleven_text_to_sound_v2`, all short, generated once and cached):

| Id | Sound | Where |
|---|---|---|
| 01 | 8-bit square tick | cells |
| 02 | 8-bit bell, three pings | H2 |
| 03 | small crate thunk | H1, U5a |
| 04 | low two-note 8-bit stinger | the stamps |
| 05 | pencil circle | E1 ring |
| 06 | pencil line | strokes and the P1 arrow |
| 07 | felt marker dash | E2, E3 |
| 08 | paper slide | S1a, S1b |
| 09 | soft air whoosh | every seam |
| 10 | laptop key | Shift+Left, typing |
| 11 | mouse click | every logged click |
| 12 | tiny UI tick | the first six cards, stages, tool calls |
| 13 | warm resolving tone | END |

### Schedule and go/no-go (solo with Claude Code)

| When (IST) | Work |
|---|---|
| Oct 16, night | Lock the lines. Audition the cast and the qix A/B. Run the full VO pass and alignment. |
| Oct 17, morning | UI takes A–E, then the pixel engine and H1–H2 |
| **Oct 17, 12:00 go/no-go** | UI takes recorded and the aligned VO done. If not, cut U5a (ladder step 1) now. |
| Oct 17, afternoon | Brush sheets E1–E3 and the marks |
| **Oct 17, 20:00 go/no-go** | The pixel hook and the three sheets rendered. If not, run ladder steps 2–3. |
| Oct 17, evening | Composite U1–U7, cursor, callouts, captions |
| Oct 18, by 13:00 | SFX, music, Scribe QA, the full render, a sound-off review, the `.srt`, upload |

**Cut ladder.** Each step only shrinks the work; the spine (hook, notebook, take A, payoff) stays.
1. Cut U5a. S4 becomes a plain cut-the-curve, and LG-07 plays over the UI verdict, which shows "106 minutes".
2. Replace E3 with a typeset worksheet: CSS-bordered chips with wipe reveals, keeping the same line.
3. Replace U6 with a still of the README's MCP transcript, captioned "captured 2026-10-16".
4. Replace A1–A4 with flat `fg-0` boxes.
5. Drop AU-01.

### Risks

| Risk | Fallback |
|---|---|
| "kicks" or "FalkorDB" misread | A/B LG-02 and OC-09 first (about 150 characters); use the respellings. Scribe QA catches misses. |
| v4 speaks a tag | Strip the tag and rely on stability. |
| ElevenLabs quota short | Synthesize the risk lines first, then the rest. Lines are cached. |
| mocha's row off screen | `github/docs` (`chalk ^5.0.1`, `[E2]`) |
| The Ask answer is wrong | OC-10b, the prod-only backup |
| The MCP model skips a tool | Retake; then ladder step 3 |
| The paste is slow or rate-limited | Warm the repo once, cut the wait, one analysis per 20 s |
| The in-app 74-min scribble does not persist for P1 | Composite the PNG pair |
| UI arrives after 0:46 once aligned | J-cut S2 under the end of OC-04, so the scrub runs under "a filter" |

---

## AI disclosure

- **End card** (24 px or larger, held at least 4 s): "Voices: ElevenLabs (AI) · Built with Claude Code under the author's direction · docs/AI_USE.md"
- **Spoken:** none. The spoken line was cut on 2026-10-19 at the author's request; the end card and the description carry the disclosure.
- **Video description:**

> Voices: ElevenLabs (AI): "Ledger" (Alice) reads only what is on screen; "On-call" (Viraj) is the engineer. Sound effects: ElevenLabs (AI). Music: synthesized locally from code (no AI model). Patient Zero was built with Claude Code (Anthropic) under the author's direction; the author reviewed every Cypher query (docs/AI_USE.md). The pixel and brush scenes are rendered from code (p5.brush 2.2.3). The UI footage is the production build in replay mode (`LLM_CHAIN=replay`), so the analyst pick is a recorded observation id and every take is identical. Every number on screen is in docs/proof-points.md. The demo org is 20 real public repos plus one badged sample repo, with lockfiles as of 2025-09-08. WOULD_PULL is exposure surface, not compromise: a fresh install in the window would have fetched the malicious version, and npm ci from the committed lockfile was safe throughout.

---

## Recording notes

Every on-screen string in this script was measured on 2026-10-16 against the production build (`:8080`) and a replay-mode API.

- **Setup.** Run the app with `LLM_CHAIN=replay`. The header chip then reads "LLM replay", and the analyst pick line reads "Analyst pick · LLM replayed". A replay is a recorded observation id, not prose: the words are rebuilt from the run's rows.
- **Take A: start (U1).**
  - It needs the autoplay from a fresh load, so reload between takes.
  - To restart the timeline without reloading, use **Play the 90 minutes**. **Pause** (also "Pause the autoplay" in the skip links) stops it.
  - Do not click **Try axios 2026** on the landing: it runs the axios triage at once.
- **Scrubbing.**
  - The scrubber is the slider labelled "Scenario time, UTC". Shift+Left and Shift+Right move it 10 minutes; the arrow keys alone move it 1 minute.
  - A manual scrub sets the clock the Run button uses (the autoplay does not), so stop exactly on 13:30. The button must read **Run triage at 13:30 UTC**: that is the clock the recorded pick and the memoized cards belong to.
  - At 13:30 the scanner row reads 0, not 1.
- **Run triage.**
  - Let the first cards land before you open one, so the ms figures are visible.
  - At the default clock, the path and fix cards are memoized and say "cached" next to the time. Show it; do not crop it out.
  - The analyst pick and "Notify 7 teams" are on screen with no click.
  - `[E2]` and `[E3]`, the Do steps and the claim map are inside "Show 2 more evidence paths …".
- **The path (U2).**
  - Use mocha: its path is zero hops, and its root pin (`debug@4.3.5`) is safe.
  - Click the repo name **in the exposure table** (`#exposures`). The tool cards hold small tables with the same repo names, and a click there selects nothing.
  - The `Node By Index Scan (x:Dep)` line sits below the fold of the open card: scroll the feed until it is in view before the A2 loop.
  - A card opens with a click on its header line.
  - **Show plan** sits inside the open card, next to **Copy Cypher**, and turns into **Hide plan**.
- **Fix and write-back (U3).**
  - **Fix** is the ghost button at the end of the row. The drawer's tabs are **Fix** and **Notice**.
  - **Mark remediated** sits in the drawer's bottom bar under either tab, and **Undo** replaces it. Esc closes the drawer.
  - **Run again** is in the band above the panes. The mark reaches FalkorDB on that re-run (`POST /api/remediate`), as a `(:Triage)-[:ASSESSED {action: 'remediated'}]->(:Repo)` record scoped to this browser session.
  - The time on screen is the real wall clock in UTC; no caption quotes it.
  - After **Run again**, scroll the feed to the `recall_triage` card ("21 repos assessed earlier in this session; 1 marked remediated: mochajs/mocha"). The verdict also gains the line "Marked remediated: mochajs/mocha".
- **Graph stats and Concentration (U4).**
  - The tabs under the exposure table are **Concentration**, **All Cypher used**, **Triage history** and **Graph stats**.
  - Graph stats describes the graph of the run on screen, so it must come before axios and the paste.
  - The Ask answer's 20 comes from the graph: the `MAINTAINER_BLAST_RADIUS` query for ljharb on `pz_acme_qix` reaches 20 of 21 repos.
  - Graph answers do not count toward the "0 of 4 model answers" limit.
- **axios (U5b).**
  - The header radio group is labelled "Scenario": **qix · Sept 2025**, **axios · Mar 2026** and **Describe an alert…**.
  - The verdict's 106 minutes runs from the first malicious publish (`axios@1.14.1`, 00:21:58) to the campaign's first OSV record (MAL-2026-2306, for the dropped dependency `plain-crypto-js@4.2.1`, 02:07:58). `axios@1.14.1`'s own record came at 03:15:49, 2 h 54 min after its publish. The video uses 106 only.
- **MCP (U6).** The model picks its own tools: retake until both `incident_exposure` and `explain_path` show. The server is checked over stdio; see "MCP transcript" in the README.
- **The paste (U7).**
  - A paste runs against the incident on screen and gets its own `pz_guest_…` graph.
  - After a paste, a scenario radio re-analyses the pasted repo, which is why the paste comes last.
  - The 9 calls were measured with `mochajs/mocha`. A repo that reaches no malicious version runs fewer calls, so check the caption before swapping repos.
