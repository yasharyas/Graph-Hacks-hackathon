# Deploy

**Local:** `cp .env.example .env` (optional, dev defaults work), then `docker compose up --build`. App http://localhost:8080, FalkorDB Browser http://localhost:3000. `APP_PORT` / `BROWSER_PORT` change the host ports.

**Bake the graphs:** `npm ci && bash scripts/bake.sh` starts a throwaway FalkorDB, ingests `data/`, and writes `deploy/dump.rdb`. Commit it. Without it the container rebuilds the graphs at boot (about 25 s).

**Render (free):** push to GitHub, then New > Blueprint, pick the repo (reads `render.yaml`). Passwords are generated. Set `GROQ_API_KEY`, `GEMINI_API_KEY` and `GH_TOKEN` in the dashboard only. Deploys build from the Dockerfile and fetch the Fontshare fonts at build time.

**Keep warm:** the free service sleeps after 15 min idle. UptimeRobot: HTTP monitor on `https://patient-zero-rayp.onrender.com/api/health`, every 5 minutes.

**Test the Render limits:** `docker build -t pz . && docker run --memory=512m --cpus=0.1 -p 10000:10000 -e REDIS_PASSWORD=x -e PZ_RO_PASSWORD=y -e PZ_RW_PASSWORD=z pz`
