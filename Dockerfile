# Patient Zero: one container = Redis + FalkorDB + the Node app (Render free: 512 MB, 0.1 CPU).
# Both stages are Debian trixie (glibc 2.41), so the Node binary copies across. Everything is pinned by digest.

FROM node:24-trixie-slim@sha256:7f486cabe892bff8fef04c0f7da8dba84a560be3e4e2740b7a86afc57ebec315 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
# Fontshare's license forbids committing the fonts, so they are fetched here (the build fails if the fetch does).
COPY web/src/design/fetch-fonts.mjs web/src/design/
RUN node web/src/design/fetch-fonts.mjs
COPY . .
RUN npx vite build && npm prune --omit=dev --ignore-scripts

FROM falkordb/falkordb-server@sha256:2e99eb1cfa3309ce338beebe24b5e9f44f9eb8ead6d6ef63dcaca436afbbaeec
COPY --from=build /usr/local/bin/node /usr/local/bin/node
# The base image has no useradd: run as a bare numeric uid. Only /app is read, only the data dir is written.
RUN mkdir -p /app /var/lib/falkordb/data && chown 10001:10001 /app /var/lib/falkordb/data
WORKDIR /app
COPY --chown=10001:10001 package.json start.sh ./
COPY --from=build --chown=10001:10001 /app/node_modules ./node_modules
COPY --from=build --chown=10001:10001 /app/web/dist ./web/dist
COPY --chown=10001:10001 server ./server
COPY --chown=10001:10001 shared ./shared
COPY --chown=10001:10001 data ./data
COPY --chown=10001:10001 fixtures/synthetic ./fixtures/synthetic
# Baked graphs (scripts/bake.sh). The glob makes this optional: without it start.sh rebuilds at boot (~25 s).
COPY --chown=10001:10001 deploy/dump.rd[b] /var/lib/falkordb/data/

ENV NODE_ENV=production PORT=10000
EXPOSE 10000
USER 10001:10001
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
# The base ENTRYPOINT (run.sh) starts an open Redis and ignores CMD, so replace it.
ENTRYPOINT ["bash", "start.sh"]
