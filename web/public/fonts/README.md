# Self-hosted fonts

Served from the app origin so the CSP stays `font-src 'self'`. Declared in `web/src/design/tokens.css` with `font-display: swap`.

| File | Family | Axis | Source | Licence | In git? |
|---|---|---|---|---|---|
| `Satoshi-Variable.woff2` | Satoshi (UI, body, wordmark) | wght 300–900 | Fontshare official download `https://api.fontshare.com/v2/fonts/download/satoshi` (zip → `Fonts/WEB/fonts/Satoshi-Variable.woff2`) | ITF Free Font License v2.0 (`FFL.txt`, shipped from the same zip) | No — fetched at build |
| `CabinetGrotesk-Variable.woff2` | Cabinet Grotesk (display, numbers) | wght 100–900 | Fontshare official download `https://api.fontshare.com/v2/fonts/download/cabinet-grotesk` | ITF Free Font License v2.0 (`FFL.txt`) | No — fetched at build |
| `MartianMono-latin.woff2`, `MartianMono-latin-ext.woff2` | Martian Mono (Cypher, code, ids) | wght 300–800 | Google Fonts CSS API (`fonts.googleapis.com/css2?family=Martian+Mono:wght@300..800`), files from `fonts.gstatic.com/s/martianmono/v6/…` | SIL OFL 1.1 (`OFL-MartianMono.txt`, copyright 2021 The Martian Mono Project Authors, no Reserved Font Name) | Yes |

## Why the Fontshare files are not committed

ITF FFL v2.0 (17 Aug 2026), read from the licence bundled in the download:

- §01 "You may self-host the Font Software on your own servers or infrastructure for use on your own websites and applications, including through standard webfont technologies such as CSS @font-face." → self-hosting in the deployed app is explicitly allowed; using the Fontshare CDN is optional.
- §02 forbids distributing the files "through another font website, font library, marketplace, **repository**, download service … **publicly accessible servers**" and forbids **subsetting or format conversion**. A public GitHub repo is a repository, so the woff2 files stay out of git and are used unmodified (no subsetting, no re-encoding).
- §06 warns the Fontshare API is "as available" and may be discontinued → we do not depend on it at runtime, only at build time, and a missing download fails the build loudly instead of shipping fallback fonts.

Martian Mono is OFL 1.1: redistribution with the licence file is permitted (the Google-served subsets are "Modified Versions"; the licence declares no Reserved Font Name, so the name may be kept).

## Fetching

```
node web/src/design/fetch-fonts.mjs          # skips files that already exist
node web/src/design/fetch-fonts.mjs --force  # re-download
```

Run it once locally and as a step in the Docker build before `vite build`. It downloads the official zips, extracts the two variable woff2 files and `FFL.txt` byte-for-byte, verifies the `wOF2` magic, and prints SHA-256s.

## Verifying in the browser

In DevTools: `[...document.fonts].map(f => f.family + ' ' + f.status)` must list Satoshi, Cabinet Grotesk and Martian Mono as `loaded`. The generic fallbacks in the stacks exist only for the swap window; if one renders in a screenshot, the fetch step did not run.
