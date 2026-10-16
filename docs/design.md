# Patient Zero — design direction

Owned by W7. UI builders (W8) build against this file and `web/src/design/tokens.css`. If a value is not here, it is not in the app. Revision 2 (after the impeccable critique, §10).

## 1. Direction

**Incident room, not dashboard.** Patient Zero is the screen an on-call AppSec engineer leaves open at 02:00: a near-black field with panels that rise by lightness, not by shadow; hairlines instead of cards inside cards; and exactly one hue allowed to be loud. That hue is infection red, and it is reserved for the thing that is infected: the malicious version, the compromised maintainer, a LOCKED row, the alert. It is never a button. Everything else is quiet and semantic: amber for "would pull", steel for "watch", green for "clean" and for teams, blue for repos, all tuned to at least 4.5:1 on their surfaces. The type is a Fontshare pairing: Cabinet Grotesk for the figures that must be read across a room ("74 min"), Satoshi for everything you operate and for every number that ticks, Martian Mono for the Cypher a judge will copy, because the proof in this product is text, not decoration. **Time is the spine**: every timestamp is UTC `HH:MM` in tabular figures, every delta is `+74 min`, and a scenario clock in the header says *when* every number on screen is true. Density is dense but calm: 13px tabular rows, 36px row height, numbers right-aligned, Cypher collapsed by default but one click away. Motion is evidence, not ornament: a path draws on when a chain is explained, a check draws on when a claim is verified, the radar sweeps only while a query is actually running; nothing bounces, nothing loops for ever, and every animation has a reduced-motion twin. The only hand-made things on the screen are two pen scribbles (p5.brush, pre-rendered) that behave like an analyst's marker on a printout: circle the number that matters, draw the arrow.

Layout axiom: everything is left-anchored and top-anchored. The one centred element is the "74 min" figure inside the contrast card.

Mode (impeccable): **Operate**. Scanability, consistency and the real usage scene outrank expression; brand lives in the details above.

## 2. Colour

Dark only (`color-scheme: dark`). Ratios are WCAG 2.x contrast against the surface in the column, computed from the hex values below (script in the W7 worktree notes; reproduced by the reviewer ±0.02). Text must be ≥ 4.5:1 (≥ 3:1 at ≥ 24px / 19px bold); non-text boundaries and graph marks ≥ 3:1.

### Surfaces and lines

| Token | Hex | Use |
|---|---|---|
| `--bg-0` | `#0A0A0B` | page, graph canvas, input fill |
| `--bg-1` | `#121214` | panels (feed, table, drawers) |
| `--bg-2` | `#19191C` | cards, table header, Cypher blocks |
| `--bg-3` | `#202024` | hover, selected row, inset wells, skeleton blocks, `::selection` |
| `--bg-scrim` | `rgb(10 10 11 / .64)` | behind dialogs and drawers |
| `--line-1` | `#26262B` | hairline dividers (decorative, 1.24:1 on bg-1) |
| `--line-2` | `#34343A` | card and panel borders (decorative, 1.51:1) |
| `--line-3` | `#6C6C76` | inputs, secondary buttons, scrollbar thumb: 3.81 / 3.60 / 3.37 / 3.12 on bg-0…bg-3 ✓ |

### Text

| Token | Hex | on bg-0 | on bg-1 | on bg-2 | on bg-3 | Use |
|---|---|---|---|---|---|---|
| `--fg-0` | `#ECEAE6` | 16.47 | 15.57 | 14.59 | 13.51 | primary text, primary button fill |
| `--fg-1` | `#A8A6A0` | 8.12 | 7.68 | 7.20 | 6.66 | secondary text, 11px table headers, graph labels |
| `--fg-2` | `#85837E` | 5.22 | 4.94 | 4.63 | 4.28 | meta ≥ 12px on bg-0/bg-1/bg-2 only; on bg-3 only as non-essential meta |
| `--fg-3` | `#6B6964` | 3.60 | 3.41 | 3.19 | 2.96 | disabled text and placeholders **only** |

### The accent

| Token | Hex | on bg-0 | on bg-1 | on bg-2 | Use |
|---|---|---|---|---|---|
| `--red-300` | `#FF8A7A` | 8.64 | 8.16 | 7.65 | hover state of red text |
| `--red-400` | `#FF5A4F` | 6.43 | 6.08 | 5.70 | red text, strokes, LOCKED, the bad node's pulse ring, scribble ink |
| `--red-500` | `#E5383B` | 4.67 | 4.41 | 4.14 | solid fills only (bad version node, solid badge). Text on it is `--bg-0` (4.67:1) |
| `--red-700` | `#8C2A2A` | 2.33 | 2.20 | 2.07 | compromised-maintainer node fill, always with a `--red-400` 1.5px ring (ring 6.4:1) |
| `--red-900` | `#2B1516` | — | — | — | red-tinted surface for the alert banner only. `--red-400` on it = 5.58:1 |

Rule: red means infected. It never marks a primary action, a link, a focus ring, a selection highlight or a decorative gradient.

### Tiers

Each tier is a text colour on a tinted chip surface. Every chip carries a leading 6px dot and the constant, so colour is never the only signal.

| Tier | Text | Chip surface | Text on chip | Text on bg-1 | Plain-language subtitle |
|---|---|---|---|---|---|
| LOCKED | `--tier-locked` `#FF5A4F` | `#331C1C` | 5.15 | 6.08 | "Lockfile pins a malicious version" (synthetic repos only, badged) |
| WOULD_PULL | `--tier-would-pull` `#E8A33D` | `#30261A` | 6.86 | 8.67 | "A fresh install in the window would have fetched it" |
| MAINTAINER | `--tier-maintainer` `#9FB3C8` | `#26292D` | 6.78 | 8.69 | "Depends on the hijacked account's packages" |
| CLEAN | `--tier-clean` `#5BBE8A` | `#1C2A25` | 6.52 | 8.17 | "No path to a malicious version" |

**Tier label rule.** The chip shows the constant (`WOULD_PULL`) in Martian Mono 11px, because the on-call engineer greps logs and exports by it; the plain-language subtitle appears under the repo name in the row's expanded card, in the drawer, and as the chip's `aria-description`. Never one without the other being one interaction away. Severity is also a temperature order (hot red → amber → cool steel → green), so a colour-blind reader still gets the ranking from the dot's brightness and the word.

### Graph palette (react-force-graph-2d, custom `nodeCanvasObject`)

| Node / edge | Token | Hex | on bg-0 | Shape |
|---|---|---|---|---|
| Maintainer (compromised) | `--graph-maintainer` + `--graph-maintainer-ring` | `#8C2A2A` fill, `#FF5A4F` ring | fill 2.33, ring 6.43 | large circle, ring 1.5px |
| Malicious Version | `--graph-bad` + `--graph-bad-pulse` | `#E5383B`, pulse `#FF5A4F` | 4.67 / 6.43 | circle; pulse = a second ring scaling 1→1.35 and fading, 1.2s, 2 repeats, then still. No `shadowBlur`, ever |
| Dep (lockfile entry) | `--graph-dep` | `#6B6B73` | 3.74 ✓ | small circle |
| Repo | `--graph-repo` | `#5C9DFF` | 7.27 | rounded square |
| Team | `--graph-team` | `#3FAE7A` | 7.11 | diamond |
| Edge (idle) | `--graph-link` | `#4A4A54` | 2.3 (decorative, projector-safe) | 1px |
| Edge (selected chain) | `--graph-link-active` | `#FF5A4F` | 6.43 | 2px, drawn on with a dash-offset over `--dur-draw`; directional particles **only during the landing autoplay** |
| Outside the selection | `--graph-dim-node` .35 / `--graph-dim-link` .2 | | | labels hidden; the selected chain keeps labels |

Shapes differ per label so the legend is not colour-only. Labels use `--fg-1` in Satoshi 12px; node ids in Martian Mono 11px.

### Semantic shortcuts

`--accent` = red-400 · `--accent-fill` = red-500 · `--accent-soft` = red-900 · `--link` = blue-300 `#7DB2FF` (8.62:1 on bg-1; repos are blue in the graph, so repo names are blue in prose and tables) · `--ok` = green-400 · `--warn` = amber-400 · primary button = `--fg-0` fill with `--bg-0` text (16.47:1), hover `#FFFFFF` · `--selection-bg` = bg-3 · `--skeleton` = bg-3 · `--opacity-disabled` .5.

### Tailwind utility names (what builders type)

Surfaces `bg-bg-0 … bg-bg-3`, `bg-scrim`, `bg-skeleton` · lines `border-line-1 … border-line-3` · text `text-fg-0 … text-fg-3` · the accent `text-infect-400`, `bg-infect-500`, `bg-infect-900`, or `text-accent`, `bg-accent-fill`, `bg-accent-soft` · tiers `text-tier-locked` + `bg-tier-locked-bg` (and `would-pull`, `maintainer`, `clean`) · graph `text-graph-repo`, `bg-graph-bad`, … · `text-link`, `text-ok`, `text-warn`, `bg-white`. Hue names such as `red-500`, `blue-500`, `amber-400` deliberately do **not** exist as utilities (Tailwind's defaults are reset and the raw hues are not re-exported), so a near-miss class fails to compile instead of rendering a near-miss colour. Verified by compiling `tokens.css` through `@tailwindcss/node`: all names above resolve; `bg-blue-500`, `text-purple-500`, `shadow-xl`, `rounded-3xl`, `font-serif`, `text-7xl` do not.

## 3. Typography

| Role | Family | File | Weights used | Sourcing | Licence |
|---|---|---|---|---|---|
| UI, body, wordmark, tables, **every live number** | **Satoshi** | `Satoshi-Variable.woff2` (wght 300–900) | 400, 500, 700 | Fontshare official download, fetched at build by `web/src/design/fetch-fonts.mjs` | ITF Free Font License v2.0 |
| Static display figures, section headings | **Cabinet Grotesk** | `CabinetGrotesk-Variable.woff2` (wght 100–900) | 700, 800 | same | ITF FFL v2.0 |
| Cypher, code, ids, ms badges, times, tier constants | **Martian Mono** | `MartianMono-latin.woff2`, `-latin-ext.woff2` (wght 300–800) | 400, 500 | Google Fonts (`fonts.gstatic.com`), committed | SIL OFL 1.1 |

Banned, including as fallbacks that render: Inter, Roboto, Poppins, Helvetica/Arial, Open Sans, Montserrat, Space Grotesk, Geist, JetBrains Mono. Stacks fall back to `ui-sans-serif, system-ui` / `ui-monospace` only for the swap window. `index.html` **preloads** the three primary woff2 files (`<link rel="preload" as="font" type="font/woff2" crossorigin>`) so that window is a frame, and the QA gate screenshots after `document.fonts.ready`.

**Figures.** Fontshare's feature data: Satoshi ships `tnum` (and `pnum`); **Cabinet Grotesk ships neither**, so its figures cannot be made tabular. Therefore anything that ticks or re-renders (counters, ms badges, clocks, depth, row counts) is Satoshi 700 or Martian Mono with `font-variant-numeric: tabular-nums`; Cabinet Grotesk is for figures that are set once per view ("74 min", exec-summary totals after the report lands, headings).

**Glyph coverage.** The Martian Mono subset has no `→` (U+2192) or `⇒` (U+21D2). Path chips use an inline 12px Lucide arrow (`arrow-right` for a resolved hop, `arrow-right-to-line`-style double bar for an ADMITS range) between chips; exported Markdown and clipboard text use the real characters, which are not font-bound.

**Licence decision.** FFL v2.0 §01 explicitly permits self-hosting via `@font-face` on our own servers; §02 forbids redistribution "through a repository … publicly accessible servers" and forbids subsetting or format conversion. The repo is public, so the two Fontshare woff2 files are **not committed** (nested `web/public/fonts/.gitignore`); they are downloaded unmodified from `api.fontshare.com/v2/fonts/download/<slug>` at build time, with `FFL.txt` written next to them. The Docker build must run `node web/src/design/fetch-fonts.mjs` before `vite build`; the script exits non-zero if the download fails, so a build cannot ship fallback fonts silently. CSP stays `font-src 'self'`. If the orchestrator prefers the CDN instead, the CSP additions would be `style-src https://api.fontshare.com` and `font-src https://cdn.fontshare.com`, and FFL §06 says that API is "as available".

### Scale (Tailwind `text-*` names are remapped to these; the defaults are reset)

| Token | Size / line | Family + weight | Where |
|---|---|---|---|
| `text-2xs` | 12 / 16 | Satoshi 500 uppercase tracking .08em on `fg-1` · Martian Mono 500 for tier constants | table headers, badges, tick labels |
| `text-xs` | 12 / 18 | Satoshi 400 · Martian Mono 400 | meta, Cypher in cards, ms badge, path chips |
| `text-sm` | 13 / 20 | Satoshi 400/500 | table cells, tool-card rows |
| `text-base` | 14 / 22 | Satoshi 400 | UI body, buttons, drawers |
| `text-md` | 16 / 24 | Satoshi 400 | narrative, inputs on touch (prevents iOS zoom) |
| `text-lg` | 18 / 24 | Satoshi 500 | card titles |
| `text-xl` | 22 / 28, −.01em | Cabinet Grotesk 800 | section headings, drawer titles |
| `text-2xl` | 28 / 32, −.02em | Cabinet Grotesk 800 (static) · Satoshi 700 tabular (live) | exec-summary figures |
| `text-3xl` | 40 / 42, −.02em | Satoshi 700 tabular | the climbing counter, with the scenario clock beside it |
| `text-4xl` | 56 / 56, −.02em | Cabinet Grotesk 800 | "74 min" |
| `text-5xl` | 80 / 80, −.02em | Satoshi 700 tabular | not used: the hero counter is `text-3xl` (40 px) at every width, so the band stays short |

Rules: body line length ≤ `--measure` (68ch). Uppercase only at 11px with tracking; never uppercase a heading. Wordmark: "Patient Zero" in Satoshi 700, 16px, no icon, no gradient. `html { font-size: 100% }` so user font-size preferences apply.

### Time rules

Every absolute time is UTC `HH:MM` (seconds only in tool cards and exports), Martian Mono, tabular. Deltas are signed: `+74 min`, `−4 min`. The header carries a **scenario clock chip** showing `Report.at` ("at 13:30 UTC") so every number is visibly time-indexed, and a **query total** ("Σ 23.4 ms · 9 queries") summed from `ToolResult.ms`. Timeline markers are labelled with time first, event second.

### Path-chip grammar

`express@5.1.0 → debug@4.4.2` is the hero string of the product. Chip = `bg-2`, radius `xs`, Martian Mono `text-xs`, padding 2×6. Package name `fg-0`; `@version` `fg-1`; a malicious version's `@version` is `red-400` and carries the product's only text underline; an ADMITS range (`^4.3.5`) is `amber-400`; separators are inline SVG arrows in `fg-2` (single arrow = REQUIRES/RESOLVES_TO hop, double-bar arrow = ADMITS); hop count is a dot-per-hop glyph (`••`) capped at 5 then `+N`. The table shows the **last hop** plus the dot count; the full chain lives in the drawer and the graph.

## 4. Space, shape, elevation, focus, density

- **Spacing:** 4px grid (`--spacing: .25rem`): 4 / 8 / 12 / 16 / 24 / 32 / 48. Gutters 16px, 24px from 768px. Card padding 16px; panel padding 16px desktop, 12px mobile; vertical rhythm between sections 24px.
- **Radii:** `xs` 3px chips and inline code · `sm` 6px buttons, inputs, tool cards, segmented controls · `md` 10px panels, exec card · `lg` 14px drawers, dialogs · `full` for the LLM-mode and claims badges only. Nothing larger.
- **Elevation** is lightness first. Level 0 `bg-0`, level 1 `bg-1` + `line-1`, level 2 `bg-2` + `line-2`, popovers `bg-2` + `shadow-popover`, drawers/dialogs `bg-1` + `shadow-overlay` + scrim. Resting cards have no shadow and no inner highlight. No glows, no coloured shadows, no blur behind cards.
- **Focus:** `outline: 2px solid --fg-0; outline-offset: 2px` on `:focus-visible`, every surface, including table rows (`outline-offset: −2px`, `scroll-margin-top` under the sticky header), graph nodes (SVG overlay ring) and the scrubber thumb. The ring sits outside the element, so it reads on the light primary button too.
- **Controls:** height 36px on fine pointers, 44px on coarse; min touch target 44×44 with ≥ 8px between targets. Press = `scale(.97)` over 120ms, **pointer-down only, buttons and chips only** (never rows, never keyboard activation). Hover states gated by `@media (hover: hover) and (pointer: fine)`. Secondary buttons use `line-3` so ghost and secondary are distinguishable at rest.
- **Inputs:** `bg-0` fill, `line-3` border, label always visible above (never placeholder-only), helper text below in `fg-2`, error text in `red-400` with an icon, 16px font on touch. Validation on blur; the paste box validates the GitHub URL pattern before enabling the button.
- **Data tables:** row 36px desktop / 44px touch; cell padding 8×12; header `text-2xs` `fg-1` uppercase, sticky; no zebra striping; hover `bg-3`; selected row `bg-3` + 2px inset bar on the left in the row's tier colour; numbers right-aligned tabular; repo names `--link`; sortable headers with `aria-sort`; below 768px rows become cards (repo, tier + subtitle, last hop, team, one action) and the header becomes a filter row.
- **Layout:** full-width; header 48px. From 1440: feed `--pane-left` 360 · graph flex · table `--pane-right` 480. 1280–1439: 320 · flex (≥ 540) · 420. 1024–1279: two panes, feed 320 left, graph over table right. Below 1024: single column with a 3-tab bar (Feed / Graph / Table), `--tabbar-h` 56px, at the bottom on touch (thumb zone). Below 768 the graph becomes a breadcrumb chain and toasts sit above the tab bar (`bottom: calc(var(--tabbar-h) + 8px)`).
- **375px specifics:** header is two rows (row 1 wordmark + scenario clock + badges; row 2 the scenario segmented control scrolling horizontally, paste becomes a button that opens a sheet); scrubber marker labels alternate on two rows and show time only; contrast card stacks its three rows; drawers are full-screen sheets; the honest-semantics line is printed in every WOULD_PULL row card (tooltips are hover-only and do not exist on touch).
- **Z-index:** sticky 10 · dropdown 20 · drawer 30 · modal 40 · toast 50 (toasts show above dialogs).
- **Scrollbars:** thin, `line-3` thumb, transparent track. Pane scroll regions are the only nested scrollers; the page itself does not scroll on desktop.

## 5. Component inventory (war room)

| Component | Anatomy | States | Tokens | Motion | Accessibility |
|---|---|---|---|---|---|
| **Header** | 48px bar: wordmark · scenario segmented control · scenario clock chip ("at 13:30 UTC") · query total ("Σ 23.4 ms · 9") · LLM-mode badge (`live / replay / template`) · claims badge (CheckDrawIcon + "12/12 traced") · paste button | mode badge: live `fg-0`, replay `steel-300`, template `fg-1` with the banner "Narration replayed · graph queries live"; claims badge `tier-clean` when all verified, `tier-would-pull` when some flagged (click opens the flagged list) | `bg-0`, bottom `line-1`, `text-sm` | none; nothing animates in the header | `<header>` landmark, skip link to results; badges have `aria-label` with the full sentence; the scenario control is `role="radiogroup"` with arrow keys |
| **Scenario control** | segmented control (radius `sm`, `line-2` frame): biohazard icon 16px · "qix · Sept 2025" · third segment "Describe an alert…" opening the free-text field (≤ 500 chars, counter) | default `bg-1`; hover `bg-3`; selected `bg-3` + `fg-0` + icon `red-400`; running: ShieldPulse? no — running = radar on the first tool card only; disabled .5 | height 32px | biohazard turns once (`animate-turn-once`, 600ms) when a run starts, then still; press scale | Enter runs; selection announced via the radiogroup |
| **Paste box** (URL or lockfile) | input + "Analyze" button + drop zone hint | idle, dragover (`line-3` → `fg-0` dashed), invalid URL (inline error, button disabled), too large (> 5 MB), unsupported (yarn / pnpm / v1 → friendly error + "try a sample repo"), rate-limited ("one analysis per 20 s", countdown), analyzing (staged progress from `AnalyzeEvent`: fetch → parse → write → enrich → admits with `done/total`) | §4 inputs | progress bar linear, no spinner | label visible; errors `role="alert"`; progress `aria-live="polite"` throttled to stage changes |
| **Timeline scrubber** | track 13:00→14:30 UTC; markers: first publish (red tick), alert, OSV record, removal (time first, event second); counts strip above (LOCKED / WOULD_PULL / MAINTAINER / scanner); play/pause **first in tab order**; thumb shows the time | playing, paused, scrubbing (re-query debounced 150ms; the UI updates instantly, no crossfade), reduced motion (steps) | track `line-3`, past `fg-1`, thumb `fg-0`, markers `fg-2`, bad `red-400`; labels `text-2xs` `fg-1` | autoplay 12s linear; counter ticks in Satoshi tabular; particles in the graph only while playing; the 74-min scribble draws when the thumb passes the OSV marker, once per session | `<input type="range">` semantics (`aria-valuetext` = "13:42 UTC, 5 repos exposed"), ←/→ 1 min, Shift 10 min, Space play/pause; the pause control is reachable before anything else (WCAG 2.2.2) |
| **Contrast card** | three left-aligned rows/columns: "Advisory scanner: **0**" · "Name grep: debug in **15** repos (no path, no owner)" · "Patient Zero: **1 LOCKED · 4 WOULD_PULL · 1 MAINTAINER**, paths + owners"; footer figure "**74 min** before the OSV record" with the scribble | numbers follow the scrubber instantly; crossfade (opacity + 2px blur, 160ms) only on autoplay jumps and preset times | `bg-1`, `line-2`, numbers Satoshi 700 `text-2xl` tabular, zero in `fg-2`, PZ numbers in tier colours; "74 min" in Cabinet | scribble: arrow wipe 400ms then loop sweep 900ms, once | one `<dl>`; the scribble images are `aria-hidden`; the sentence is real text |
| **Tool card** (feed) | header: tool name (Satoshi 500) · args as `key=value` chips · ms badge (Martian Mono, right) · overflow menu (Show plan, Copy Cypher) · expand; body: summary line; rows table (≤ 5 shown, "+N more"); collapsible Cypher block (`bg-2`, Martian Mono 12/18) | pending (RadarIcon + 3 skeleton rows; after 3 s the radar is replaced by staged text "waiting for FalkorDB… 4 s"), done, error (`red-400` 2px left bar + cause + fix + `requestId` in Martian Mono, copyable), truncated (`+N rows withheld`), cancelled | `bg-2`, `line-2`, radius `sm`, padding 12 | enter: opacity + 6px rise, 200ms, stagger 40ms up to 6; expand 200ms `grid-template-rows` 0fr→1fr; radar sweeps only while this card is pending | `<article aria-busy>`; Cypher in `<pre><code>`; ms badge `aria-label="FalkorDB execution time 4.7 ms"`; the feed's live region announces a throttled summary ("4 of 9 tools done"), never each card |
| **Narrative + claim chips** | paragraph `text-md`; entities as chips: verified → `tier-clean` with CheckDrawIcon, click highlights the path; flagged → `red-400` strike-through + visible "(not returned by any graph query)" suffix; a "Flagged claims (N)" disclosure lists `guard.flagged` | verified, flagged, hovered (path highlights) | `fg-0`, chips `bg-2` | the first 6 checks draw on (≤ 450ms each, stagger 40ms); the rest appear | chips are `<button>`s; flagged reasons are text, not hover-only |
| **Ask box** | input under the narrative ("Ask about this triage…"), send button, bounded to 4 rounds, answers append as tool cards + narration | idle, running (radar on its card), limit reached ("10 per 10 min"), error | §4 inputs | as tool cards | label visible; `aria-live` summary |
| **Exposure table** | columns Repo · Tier · Path (last hop + hop dots) · Team · one action ("Fix" → drawer with Fix / Notice tabs); header filter row: prod-only toggle (dev-only rows show a `dev` tag on the chip), tier filter, search | hover, selected (left bar), remediated (strike + `tier-clean` "remediated 14:02" with **Undo** for 10 s), synthetic badge ("sample repo"), filtered-empty ("No prod exposures. Show dev-only (3)"), > 300 nodes truncated note | §4 density; fits `--pane-right` 420 (160 + 96 + 110 + 64 + 40 ≈ 470 with 12px padding collapsing on the action column; below 1280 the Team column folds into the row subtitle) | row select instant | `<table>` with visually-hidden `<caption>` carrying the honest-semantics line; sortable headers `aria-sort`; whole row clickable with the repo link as the accessible name; selection drives the graph for keyboard users |
| **Path graph** | `react-force-graph-2d`, `dagMode:'lr'`, legend row with the 5 shapes; selected chain at full opacity with labels, rest at `--graph-dim-*` without labels; node tooltip on hover **and** focus/click | idle, selected chain, autoplay (particles), empty ("run a triage to see paths"), truncated (`showing 300 of N nodes`) | §2 graph palette, canvas `bg-0` | selected chain stroke draws on (dash-offset, `--dur-draw`); bad-node pulse 2 repeats then still; fit-to-view 280ms `ease-out`; particles only during autoplay | canvas `role="img"` + `aria-label` summarising the selected chain; a visually-hidden list of chains mirrors the canvas; keyboard users select rows in the table |
| **Drawers** (Fix / Notice tabs) | right drawer 420px (full-screen sheet under 768): title (`text-xl`), repo + tier chip + subtitle, tabs: Fix (`overrides` JSON block, steps, PR body) / Notice (Slack text); footer: Copy, Export (Markdown / JSON), Share link, Mark remediated, Cancel run (while running) | open, copying ("Copied" 1.2s), clipboard denied (shows a selectable text block), remediated (+ Undo toast) | `bg-1`, `shadow-overlay`, scrim | in: `translateX(100%)→0` 280ms `ease-drawer`; out 200ms; scrim fade 160ms | focus trapped and returned; Esc closes; `role="dialog"` `aria-labelledby`; Copy announces via `aria-live="polite"` |
| **Exec summary card** | top of results: title "qix · at 13:30 UTC" · three figures: exposed repos by tier (stacked bar + numbers), "+74 min ahead of the advisory", top-3 maintainer concentration (bars) · Share | static once the report lands | `bg-1`, `radius-md`, figures Cabinet `text-2xl` | enters with the report event, 200ms | figures are `<dl>`; bars have text values beside them |
| **Tabs** (below the table) | Concentration (PageRank bars) · All Cypher used (one `<pre>`, Copy all) · Triage history (`recall_triage` rows: when, by session, remediated) · Graph stats (`GRAPH.MEMORY USAGE`, node counts, EXPLAIN toggle per query) | per tab empty states | `text-sm` tabs with a 2px `fg-0` underline | `--dur-instant` | `role="tablist"`, arrow keys |
| **Onboarding hint** (replaces coach marks) | one inline hint card under the scenario control after autoplay: "Click a row to see its path · Show Cypher on any card · Paste your own repo" with the `coach-hint` scribble; Dismiss | shown once (localStorage), dismissed | `bg-2`, `line-2` | enter 200ms | no focus stealing, no scrim, Esc not required; `role="note"` |
| **Empty / error states** | `empty-lockfile` illustration (grey scribble, one red mark), one-line cause, one-line fix, primary action ("Try a sample repo") and secondary ("Paste a lockfile"); `requestId` line in Martian Mono when the server returned one | empty results, yarn/pnpm/v1 rejected, repo without lockfile, rate-limited (countdown), server waking (staged text, ≤ 60 s), network error (retry), SSE disconnected (auto-retry with a visible counter) | `fg-1` copy, `red-400` only on the cause line of real errors | illustration fades 120ms | `role="status"` for empty, `role="alert"` for errors; the action is a real button; copy states cause + fix |
| **Toasts** | bottom-right from 1024px (bottom-left below it, above the tab bar and the Ask bar); it moves to the other bottom corner, then the top, only when it would cover a focused control (a script-focused pane does not count); one copy toast at a time (a new copy replaces it); 320px, icon + sentence + optional action (Undo) | info, success (`tier-clean` icon), error (`red-400`) | `bg-2`, `shadow-popover` | enter 200ms from below, exit 140ms; timers pause on hover and when the tab is hidden | `aria-live="polite"`, never steals focus, auto-dismiss 4s (Undo toasts 10s) |
| **Buttons** | primary (`fg-0` fill, `bg-0` text) · secondary (`bg-2` + `line-3`) · ghost (`fg-1` → `fg-0`) · icon buttons always with `aria-label` and a tooltip (`--tooltip-delay` 400ms, siblings instant) | hover, active (pointer scale .97), loading (label stays, 14px spinner replaces the icon), disabled (`--opacity-disabled` + `aria-disabled`) | height `--control-h`, radius `sm`, padding 0 14px | 120ms press, 160ms hover colour | one primary per view; loading buttons keep their width |

Copy rules (from the plan's honest semantics): WOULD_PULL rows always carry the line "A fresh install during the window would have fetched the malicious version. Lockfile-pinned `npm ci` builds were safe." — as a tooltip on fine pointers, printed in the row card on touch and in the drawer always. The footer disclaimer is permanent, `fg-2`, 12px, not collapsible. Errors show `requestId` when present (S12) in Martian Mono next to a plain-language cause and fix.

**First-load autoplay composition.** Landing = header + scrubber + contrast card + graph; the table and feed are empty with their empty states. The scrubber plays 13:00→14:30 over 12 s; the counter (Satoshi 700 `text-3xl` tabular, the clock beside it) climbs as the graph fills; "OSV advisories: 0" holds until 14:26; the caption names the 74-minute gap from about 2 s in ("no advisory for 74 min, until 14:26"); the 74-min scribble draws when the thumb passes the OSV marker. The three buttons are there from the first paint, left-aligned under the contrast card: **Run triage** (primary) · Try axios 2026 · Paste your repo. The pause control is the first focusable element; a keyboard user can stop it immediately. Under reduced motion the final state renders at once with "Play the 90 minutes".

## 6. Motion

Decision order (Emil Kowalski's framework): (1) how often will this be seen? Keyboard-initiated and 100×/day actions do not animate. (2) What is the purpose: spatial continuity, state change, explanation, feedback, or softening an abrupt change? If the answer is "looks cool", do not animate. (3) Easing: entering/exiting → `--ease-out`; moving on screen → `--ease-in-out`; drawers → `--ease-drawer`; constant motion → linear; never `ease-in`. (4) Duration from the table.

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(.23, 1, .32, 1)` | enter, exit, press release, expand |
| `--ease-in-out` | `cubic-bezier(.77, 0, .175, 1)` | things that travel (graph fit-to-view) |
| `--ease-drawer` | `cubic-bezier(.32, .72, 0, 1)` | drawers and dialogs |
| `--dur-instant` | 0 | keyboard shortcuts, tab switches, filter toggles, scrubbing |
| `--dur-press` | 120ms | pointer `:active` scale .97 on buttons and chips |
| `--dur-fast` | 160ms | hover colour, tooltips (siblings instant after the first), scrim |
| `--dur-base` | 200ms | dropdowns (origin at trigger, scale .97→1), card enter (opacity + 6px), row expand |
| `--dur-slow` | 280ms | drawer, dialog (≤ 300ms ceiling for UI feedback) |
| `--dur-fade` | 120ms | the only duration that survives reduced motion |
| `--dur-draw` | 600ms | path, check and scribble draw-on (explanatory; interruptible; never blocks input) |
| `--dur-sweep` | 1800ms | radar loop, only while a query is running |
| `--stagger` | 40ms | list entrance, at most 6 items (240ms total) |

Patterns:
- **Enter:** opacity 0→1 with `translateY(6px)→0`, or `scale(.97)→1` for anchored popovers (origin at the trigger; dialogs stay centred). Never from `scale(0)`.
- **Exit:** ~70% of enter (drawer 280 → 200, toast 200 → 140). Transitions, not keyframes, for anything that can re-trigger quickly (toasts, chips).
- **Content swap:** crossfade with `filter: blur(2px)` at the midpoint, 160ms — only on autoplay jumps and preset times, never while the user is scrubbing (direct manipulation is instant).
- **Counters:** Satoshi tabular, tick by integer steps; no spring, no overshoot.
- **Press:** `transform: scale(.97)` on pointer `:active` for buttons and chips only.
- **Hover:** gated behind `(hover: hover) and (pointer: fine)`.
- **Performance:** animate only `transform`, `opacity`, `clip-path`, `mask`, `filter`; with `motion`, pass the full `transform` string (not `x`/`y`) when the main thread may be busy (autoplay). Looping icon animations are CSS keyframes (`animate-radar-sweep`, `animate-pulse-ring`, `animate-turn-once`) so they stay smooth while React renders tool results.
- **Reduced motion** (`prefers-reduced-motion: reduce`): CSS collapses every `--dur-*` except `--dur-fade` to 0, stops `[class*="animate-"]` and the scribble reveals, and restricts transitions to opacity/colour properties (nothing gains a transition it did not have). React mounts `<MotionConfig reducedMotion="user">` at the root so every `motion` component obeys the setting without per-author discipline; icons additionally read `useReducedMotion()` to pick their still variant. Concretely: autoplay renders the final state with a Play button; counters jump; particles are off; the radar is a still ring with a dot; paths and checks appear complete; no pulse; no turn; scribbles appear whole.

## 7. Animated icons

Lucide-style: 24×24 viewBox, 1.75px stroke, round caps and joins, `currentColor`, rendered at 16 / 20 / 24. Built with `motion/react` (`motion` 14) as components `<RadarIcon active />`, `<PathDrawIcon play />`, `<CheckDrawIcon />`, `<ShieldPulseIcon alert />`, `<BiohazardIcon turn />`, each taking `size`, `title` (rendered as `<title>` + `aria-label`, or `aria-hidden` when decorative). Durations and easings come from a shared `motionTokens` module that reads `--dur-draw`, `--dur-fade`, `--ease-out` from `getComputedStyle(document.documentElement)` once, so icons never hardcode numbers.

| Icon | Where | Geometry | Animation | Reduced motion |
|---|---|---|---|---|
| **Radar** | the pending tool card only (never the header) | circle r 9; inner circle r 4 dashed; sweep line from centre to r 9; a 1.5px blip at (16, 9) | sweep rotates 360° linear 1.8s (CSS `animate-radar-sweep` on a `<g>` with `transform-origin: 12px 12px`); blip opacity 1→0 per pass; stops the instant the result arrives; after 3 s pending, replaced by staged text ("waiting for FalkorDB… 4 s") so a 60 s server wake is never a spinning icon | still: ring + dot at opacity .6 |
| **Path draw** | when a chain is explained / a row is selected | polyline (3→9→15→21 on x, zig on y) through 4 node circles r 2 | `motion.path` `pathLength 0→1` over `--dur-draw` `ease-out`; nodes `scale .6→1` + opacity, 160ms each, stagger 120ms; replays on new selection, interrupting the previous | appears complete |
| **Check draw** | verified claim chips; claims badge; "copied" | circle r 9 + check path (7,12.5 → 10.5,16 → 17,9) | circle `pathLength` 240ms, then check 200ms, `ease-out` (≤ 450ms); once per chip; the first 6 stagger 40ms, later ones appear | fade in 120ms |
| **Shield pulse** | the alert banner, when a free-text alert is parsed | shield path; a second shield outline behind it | outline scales 1→1.35 and fades .5→0, 1.2s `ease-out`, **2 repeats, then still** (CSS `animate-pulse-ring`); re-arms only on a new alert | static shield with 20% fill |
| **Biohazard** | scenario segments | three arcs around a centre circle (drawn Lucide-style, not the Unicode glyph) | **one** 360° turn over `--dur-draw` when a run starts (`animate-turn-once`); otherwise still; never loops, never while merely selected | still |

Reference pattern:

```tsx
import { motion, useReducedMotion } from 'motion/react';
import { motionTokens } from './motionTokens'; // { draw: 0.6, fade: 0.12, easeOut: [0.23, 1, 0.32, 1] } read from CSS

export function PathDrawIcon({ play = true, size = 20, title }: { play?: boolean; size?: number; title?: string }) {
  const reduce = useReducedMotion();
  const draw = play && !reduce;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
         strokeLinecap="round" strokeLinejoin="round" role={title ? 'img' : undefined} aria-hidden={!title}>
      {title && <title>{title}</title>}
      <motion.path d="M3 17 L9 7 L15 17 L21 7" key={String(draw)}
        initial={draw ? { pathLength: 0, opacity: 0 } : false}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: motionTokens.draw, ease: motionTokens.easeOut }} />
      {[[3, 17], [9, 7], [15, 17], [21, 7]].map(([cx, cy], i) => (
        <motion.circle key={i} cx={cx} cy={cy} r={2} fill="currentColor" stroke="none"
          initial={draw ? { scale: 0.6, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.16, delay: draw ? 0.12 * i : 0, ease: motionTokens.easeOut }}
          style={{ transformOrigin: `${cx}px ${cy}px` }} />
      ))}
    </svg>
  );
}
```

## 8. Scribbles (p5.brush, pre-rendered)

Produced once in `design/scribbles/` (p5 2.3.4 + p5.brush 2.2.3, fixed seeds), exported as transparent PNG + WebP at 2× into `web/public/scribbles/`, shown with `<picture>` + explicit `width`/`height` (no layout shift), `aria-hidden="true"`. The app ships no p5 and no WebGL for these. Every stroke is revealed along its own drawing direction with the primitives in `tokens.css`: `.scribble-wipe` (clip-path, left→right) for arrows and underlines; `.scribble-sweep` (a conic mask growing clockwise from the pen-down point) for loops. Under reduced motion they appear whole. **At most two scribbles in one viewport.** Export post-processing recolours every painted pixel to the exact ink token and feathers 1px at 2×, because p5.brush composites the pen as opaque, darkened pixels (measured `#C03830`, zero partial-alpha pixels before the fix).

Phase 0 asset: **`seventy-four-min`**, two layers + a combined image, 480×300 at 1× (960×600), ink `#FF5A4F`, brush `pen`, seed `1757341611` (the incident's `advisoryAt`).
- `seventy-four-min-loop`: one continuous 1.85-turn stroke drifting ~9% inward, ≈216×100, tilted −4°, around the 56px "74 min" centred at (300,160); pen down at the top-left, trails off at the bottom. Reveal `.scribble-sweep` with `--pen-x: 62.5%; --pen-y: 53%; --pen-from: 282deg`, 900ms, delay 350ms.
- `seventy-four-min-arrow`: starts at (56,74), below the two-line caption "before the OSV record existed", lands on the loop's upper-left shoulder; firm start, lighter tip, two solid barbs. Reveal `.scribble-wipe` 400ms.
- Placement: absolutely positioned over the contrast-card footer / landing timeline; draws when the scrubber passes the OSV marker or when the contrast card enters the viewport, once per session.

| Slug | Phase | Canvas (1×) | Ink | Placement | Reveal |
|---|---|---|---|---|---|
| `seventy-four-min-arrow` + `-loop` | 0 (done) | 480×300 | red-400 | contrast card footer / landing timeline | wipe 400ms, then sweep 900ms |
| `contrast-arrow` | 3 | 320×160 | red-400 | from "Advisory scanner: 0" to the Patient Zero column | wipe 400ms |
| `empty-lockfile` | 3 | 480×360 | fg-1 + one red-400 mark | empty / error states, left of the copy | fade only |
| `coach-hint` | 3 | 160×120 | fg-0 | the single onboarding hint | wipe |
| `tagline-underline` | 3, optional | 640×48 | red-400 @ 85% | under the landing tagline, never on screen with the 74-min loop | wipe 500ms |

Production rules are in `design/scribbles/README.md`.

## 9. Anti-slop checklist (UI builders: every PR must pass all of it)

Colour and surface
- [ ] No purple, violet, indigo or "cyber" neon anywhere. The palette is the hexes in §2 plus `#FFFFFF` for the primary button hover.
- [ ] No gradients on surfaces, text or borders. No animated gradient borders, no glow pulses, no `shadowBlur` on the graph.
- [ ] No glassmorphism: no `backdrop-filter: blur` on cards; blur exists only in the 2px content crossfade.
- [ ] No shadows on resting cards; elevation is lightness + hairline. Shadows appear only on popovers, drawers, dialogs, toasts.
- [ ] Red appears only on infection semantics. A red primary button, a red focus ring or a red text selection is a bug.

Layout and type
- [ ] Nothing is centred except the "74 min" figure. Headers, cards, tables, empty states are left-aligned.
- [ ] No hero blob, orb, mesh, particle background, grid-glow or "3 feature cards with icons" row. Particles exist only on the selected chain during the landing autoplay.
- [ ] No card inside a card. A tool card sits directly on the panel.
- [ ] Radii from the 4-step scale only; pills only for the two header badges.
- [ ] Satoshi / Cabinet Grotesk / Martian Mono render (check `document.fonts`); no banned font, even transiently in screenshots (preload is in place).
- [ ] Live numbers are Satoshi/Martian tabular; Cabinet Grotesk never ticks.
- [ ] Uppercase only at 11px tracked labels on `fg-1`. Headings are sentence case. No "Welcome to…", "Powered by AI", sparkles, or Unicode ticks/arrows in UI text (icons are SVG).
- [ ] Table numbers right-aligned and tabular. No zebra stripes.

Icons and imagery
- [ ] No emoji anywhere. Icons are Lucide + the five animated icons in §7, one stroke style (1.75px, round joins).
- [ ] Illustrations are the p5.brush scribbles only, max two per viewport; no stock isometric art, no 3D blobs, no AI-generated imagery.

Motion
- [ ] No `transition: all`. No `ease-in`. Nothing over 300ms except `--dur-draw` draw-ons and the radar.
- [ ] Nothing loops for ever except the radar while a query is actually running (and it yields to text after 3 s). Pulses repeat twice; the biohazard turns once.
- [ ] Keyboard-triggered changes and scrubbing are instant; press scale is pointer-only.
- [ ] `<MotionConfig reducedMotion="user">` is mounted; every animation verified with the OS setting on.

Content and trust
- [ ] Every number on screen comes from a tool result, a fixture, or `docs/proof-points.md`. No invented stats, no decorative "99.9%".
- [ ] Every number is time-indexed: the scenario clock is visible whenever counts are.
- [ ] WOULD_PULL rows carry the honest-semantics line; the footer disclaimer is present.
- [ ] Empty and error states state cause + next action, with `requestId` when present; no bare codes, no "Something went wrong".
- [ ] Labels visible (never placeholder-only); icon buttons have `aria-label`s; focus rings visible on every surface; contrast verified against §2, not assumed.

Mechanical gate: `node <impeccable>/scripts/detect.mjs --json web/src` must report 0 findings before the W8 gate (install its optional parser deps so it is not a degraded regex run), in addition to axe.

## 10. Impeccable critique log (Phase 0)

Run as the critique command prescribes: Assessment A by an isolated reviewer agent that read the direction, tokens, bench and the scribble PNG unanchored; Assessment B = `detect.mjs` on `design/scribbles` (degraded regex mode on this machine: 0 findings, an undercount). No browser overlay. Nielsen for the direction as first specified: **25/40** (Status 3 · Real world 3 · Control 2 · Consistency 2 · Error prevention 2 · Recognition 3 · Flexibility 2 · Minimalism 3 · Recovery 3 · Help 2). The reviewer reproduced every stated contrast ratio within ±0.02.

What it flagged and what changed (all applied in this revision):
- **P0 contradictions for parallel builders**: scenario chips were `radius-full` against the "badges only" rule → segmented control, `radius-sm`; header listed motion "none" while the radar was also "in the header" → radar on the pending card only; the biohazard spun "while selected" (forever) → one turn on run start; `::selection` was `red-900` against "red means infected" → `bg-3`; `--edge-highlight`/`shadow-1` were specified but unused and invisible on `#121214` → deleted, shadows are `popover` / `overlay` only; graph focus vs table focus → table drives the graph for keyboard users.
- **P1 fallback glyphs**: `→`/`⇒` are outside Martian Mono's subset → SVG arrows in path chips; the path-chip grammar is now specified (§3).
- **P1 table and layouts did not fit their own numbers**: 7 columns ≈ 720px in 480px → Repo · Tier · last hop · Team · one action; Scope behind the prod toggle; `--pane-right` 420 and `--pane-left` 320 below 1440 so the graph gets ≥ 540 at 1280; 375px header, scrubber labels, contrast card, toasts and the touch-only honest-semantics line are specified.
- **P1 reduced motion not guaranteed for `motion`**: `<MotionConfig reducedMotion="user">` mandated; the universal `transition-duration` rule (which gave reduced-motion users *more* transitions) removed; `[class*='animate-'] { transform: none }` (which killed static transforms) removed.
- **P2 scribble**: ink measured `#C03830` and fully aliased → export recolours to `#FF5A4F` and feathers; loop was 222×137 around a 40px cap-height figure → 216×100, tilted −4°; arrow started inside the caption and stopped 20px short → starts at y 74, lands on the loop; pressure direction fixed; barbs solid; curtain wipe → arrow wipe + conic sweep from the pen-down point, two layers.
- **Token hygiene**: fonts/sizes/radii/shadows/easings moved into `@theme` proper (no `:root` self-reference across the layer boundary); `html { font-size: 100% }`, unitless line-height; dead `@media (hover: none)` rule removed; `--graph-link` `#3A3A42` (1.8:1) → `#4A4A54` (2.3:1); `--line-3` failed 3:1 on bg-2 → `#6C6C76`; 11px headers moved from `fg-2` to `fg-1`; `--graph-dim` .18 → nodes .35 with labels hidden; `--graph-bad-glow` → `--graph-bad-pulse`; added `--opacity-disabled`, `--skeleton`, `--tooltip-delay`, `--tabbar-h`, `tr:focus-visible` offsets, `[aria-disabled]` styling; toasts over dialogs stated.
- **Specificity**: time rules, the scenario clock and query total, path-chip grammar, the tier label rule, Unicode tick → CheckDrawIcon, coach-mark tour → one inline hint, scribbles capped at two per viewport.
- **Inventory**: added Ask box, Tabs, paste-box states with `AnalyzeEvent` progress, `requestId` display, template-mode banner, flagged-claims list, autoplay composition, cancel run, undo remediate, clipboard denied, truncation, filtered-empty, SSE reconnect, throttled live region, pause-first tab order.

Kept against the reviewer's advice, with the reason: the **radar, shield and biohazard icons** and the **graph particles** are in the orchestrator's brief and the plan's hero visual; they stay, bounded so that none of the slop properties hold (no infinite loop, no spin while idle, radar yields to text after 3 s, particles only during autoplay). The reviewer's recommendation to drop the biohazard and shield entirely is recorded for the orchestrator (§11). The `tagline-underline` stays on the Phase 3 list as optional.

Builders re-run `/impeccable critique` on the rendered war room at the Phase 2 gate; the target is ≥ 32/40.

## 11. Decisions and open items for the orchestrator

1. **Fonts in the build.** Add `node web/src/design/fetch-fonts.mjs` to the Dockerfile before `vite build` (and to the README setup). Build-time outbound HTTPS to `api.fontshare.com` only. Alternative: Fontshare CDN with CSP `style-src https://api.fontshare.com; font-src https://cdn.fontshare.com`.
2. **Preload.** `web/index.html` must preload `Satoshi-Variable.woff2`, `CabinetGrotesk-Variable.woff2`, `MartianMono-latin.woff2` (`<link rel="preload" as="font" type="font/woff2" crossorigin>`), and mount `<MotionConfig reducedMotion="user">` at the React root.
3. **Tailwind resets.** `tokens.css` resets `--color-*`, `--font-*`, `--text-*`, `--tracking-*`, `--radius-*`, `--shadow-*`, `--ease-*`, `--animate-*`. `text-sm` is 13px, hue utilities do not exist. Builders read §2–§3 before writing utilities.
4. **Icon set decision.** The reviewer's view is that radar / shield / biohazard are stock security-SaaS metaphors and the product's thesis is paths; dropping the shield and the biohazard (keeping radar, path, check) would be the stronger choice. The brief mandates all five; they are specified bounded. Your call.
5. **Graph shapes and draw-on.** `react-force-graph-2d` needs a custom `nodeCanvasObject` (5 shapes, maintainer ring, pulse ring) and a `linkCanvasObject` for the dash-offset draw-on; budget ~60 lines in PathGraph.
6. **Share image.** The exec summary card doubles as the 1200×630 share card; no html-to-canvas dependency is installed. Decide client-side render vs a W13 pre-render.
7. **Cabinet Grotesk has no `tnum`.** Counters are Satoshi; if you want the Cabinet look on the hero counter, it must only render the final value.

## 12. Revisions after persona QA (rounds 2 to 7)

These supersede the sections above where they differ.

- **Header:** clock, mode and claims pills share one radius (`rounded-xs`). The clock shows the date ("Sep 8, 2025 · 13:30 UTC"). From 1280 px the FalkorDB ms sits inside its pill.
- **Laptop density:** at widths of 1024 px and up with heights of 900 px or less, the narrative is one step tighter (14 px headline). The mode and "cached" gloss moves into the header pill's title. An empty analyst pick renders nothing. Target: the first tool card's top at 560 px or less at 1366×768.
- **Verdict:**
  - It shows as a headline plus one line per tier, never clamped mid-sentence.
  - WHY shows whole path sentences only.
  - Every disclosure names what it reveals ("Show 2 more evidence paths, who to notify and the steps").
- **Autoplay caption:** one polite line narrates the 12 s replay in three states. Under reduced motion it shows the final state.
- **Text floor:** nothing is set under 12 px. `text-2xs` is 12 px, and code is `max(.92em, 12px)`.
- **Path text:** a scope shortens from the left (`@ty…/parser@8.30.1`), and package names stay whole. The full ref is the accessible name and the title.
- **Graph:** the selected chain takes its tier colour (LOCKED red, WOULD_PULL amber, MAINTAINER steel), and the legend has six entries.
- **Time and hindsight:** numbers, verdicts and notices are as of the scenario clock. Later facts appear only in sentences that start "In hindsight", or in the Fix tab's "Today, in hindsight" note.
- **Phone:**
  - Tier counts open the legend.
  - Every control, chips included, has a 44 px target on coarse pointers.
  - The drawer's sticky bar stays one row, and status shows as a pill that clears itself.
- **Fix tab order:**
  - It opens with "Today, in hindsight" (what to do now).
  - Next comes the check against today's package.json, for a pasted repo judged on a pre-incident snapshot.
  - The scope note follows as secondary text.
  - Above Copy JSON sits a line naming any override or pin to skip.
- **Table:** a long repo id gives way at the owner first (`ni…/nightwatch`), never at the name. Below 1366 px, Export is icon-only, with the same accessible name.
- **Paste sheet:** progress and errors sit after the fields, sticky at the bottom (so nothing above them moves). A long error opens with one line, and its details sit behind "How to check it by hand".
- **Round 6 QA (laptop, phone, keyboard):**
  - At 1280x720 and 1024x768 (`tight`) the narrative keeps one Why sentence with its `[E1]`. The headline drops its "In hindsight: ..." sentence there instead: the band, the exec strip and the caption already give the 74 minutes. Below 1440 px the exec strip is one row, its hindsight half screen-reader text.
  - The Notify roster is a list: one row per team (team, channel, then its repos as text), "Copy notice" at the end of the row, 24 px (44 px on touch). A copied notice ends with "Details:" and a link back to the run.
  - On a coarse pointer the Why sentence's names are text, not 28 px chips on 28 px lines: a row of 44 px "Evidence E1" buttons sits under it. `[E1]` is named "Evidence E1: open the explain_path query". The chips of a narrative row are one Tab stop; the arrow keys move between them.
  - Past the removal (15:15 for qix) the band and the exec strip are past tense: "1 repo was one install from malware until 15:15".
  - Wall-clock stamps (triage history) are UTC like every other time. A pasted repo's Graph stats say why there are no node and edge counts.
  - Strips keep their height from the first paint: the shared-repo note reserves its longest outcome, and the shared-result strip stays ("re-checked") instead of leaving when the analysis ends.
  - A phone held sideways: Play is icon-only and the headline shares its row, so the track and the caption sit above the tab bar. The tier key sits beside its "?" when it fits neither above nor below it.
  - Share card: `web/public/og-card.png` (1200x630) is a screenshot of the landing at the end of its autoplay; re-render it when the landing changes.
- **Round 7 (win audit A2: the agent on the first screen).** This supersedes the laptop-density target above (the first tool card's top at 560 px or less at 1366x768).
  - Under Why, with no click, the narrative shows what the agent did. Each line is read from the run, and none is invented:
    - "Analyst pick · LLM live", or "replayed" (the run's real mode), then the pick's own sentence. With no pick (template mode) nothing shows.
    - "Notify 7 teams", with the first three team names. "Roster" opens the disclosure scrolled to the roster and moves focus there.
    - "Next qix? sindresorhus: 43% of top-3 PageRank, reaches 21 of 21 repos". It is the Concentration tab's first row, printed by the same function (`components/agent.ts`), and it opens that tab. The share is of the listed maintainers' combined PageRank, so the line says "top-3".
  - A pasted repo shows only the pick: it has no team to notify, and its Concentration tab is collapsed.
  - The Ask placeholder is "If ljharb were hijacked next, which repos would it reach?": the runner-up in Concentration that is a person, not the line's own. A pasted repo keeps "Which exposures are prod-only?".
  - Room, by window height:
    - At 800 px or less (1366x768) the headline drops its "In hindsight" sentence, as it already did at `tight`. The scrubber's marks still say when.
    - At `tight` (1280x720, 1024x768) the Next line goes first. Pick and Notify stay.
    - The disclosure label no longer names the pick. The first tool call now sits below the fold at 1366x768.
  - The agent lines' place is held while the verdict is coming (`AgentRoom`, and the pick's placeholder), so the tool calls do not jump down when the verdict lands.
  - Fix: the `tight` variant had lost its second media clause (1024x768 never matched), so ToolFeed's placeholder was 64 px too tall there. It is now two rules.
- **Round 7b (polish).**
  - Why: a name longer than 33 characters (a pasted repo's `@typescript-eslint/eslint-plugin@6.21.0`) is a `span role="button"` with `box-decoration-break: clone`, not a `<button>`. A button is one unbreakable box, so it wrapped the name inside itself: a bordered block that split the sentence. The span breaks across lines like prose, each line boxed. Shorter names stay buttons.
  - Repo column, checked and unchanged: the measure is exact. The whole id shows as soon as the cell holds it (`FalkorDB/falkordb-browser` is 153 px, so from a 156 px cell: 1540 px wide, and at 1024 px). At 1440 px the cell is 136 px, so the owner gives way (`Fa…/falkordb-browser`). More room would cost the path column its 22 characters.
  - `recall_triage` card: the ACTION column is 4.75 rem ("remediated" is 59 px) and the repo column takes what is left, instead of a fixed 46%.
  - FalkorDB time: the header pill, the feed heading and the Graph stats tab all say it is each query's own FalkorDB time added up, not the run's wall clock. The queries run one after another. The gap to "Run total" comes from cached calls, which count the time they first took (42 of 49 on qix: 495 ms against 248 ms).
