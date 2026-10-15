#!/usr/bin/env bash
# Bakes deploy/dump.rdb: ingest the committed data/ into a FRESH throwaway FalkorDB (never the dev one, it holds test
# graphs), SAVE, copy the RDB out. The image copies it to the data dir, so production boots without ingesting (~25 s saved).
# Needs docker + node 24. Run from anywhere. The FalkorDB image must match the Dockerfile's server (same module version).
set -euo pipefail
cd "$(dirname "$0")/.."

IMG=falkordb/falkordb@sha256:b0bdcac2cbaff989e77cb0610439b7a9289e86de033ccbbd4368b66fb680ae7a
NAME=pz-bake-$$
PW=$(node -p "require('node:crypto').randomBytes(16).toString('hex')") # random per run, dies with the container
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

docker run -d --name "$NAME" -p 127.0.0.1::6379 -e BROWSER=0 \
  -e "REDIS_ARGS=--requirepass $PW" \
  -e FALKORDB_ARGS="TIMEOUT_MAX 30000 TIMEOUT_DEFAULT 15000 RESULTSET_SIZE 50000 QUERY_MEM_CAPACITY 67108864 THREAD_COUNT 1" \
  "$IMG" >/dev/null
rcli() { docker exec -e REDISCLI_AUTH="$PW" "$NAME" redis-cli --no-auth-warning "$@"; }
until [ "$(rcli PING 2>/dev/null)" = PONG ]; do sleep 0.3; done

# build.ts connects as the default user: this container has no ACL users (start.sh creates them at boot).
FALKOR_HOST=127.0.0.1 FALKOR_PORT=$(docker port "$NAME" 6379/tcp | head -1 | sed 's/.*://') \
  REDIS_PASSWORD="$PW" PZ_RO_PASSWORD="$PW" PZ_RW_PASSWORD="$PW" node server/ingest/build.ts

rcli SAVE
mkdir -p deploy
docker cp "$NAME:/var/lib/falkordb/data/dump.rdb" deploy/dump.rdb
echo "deploy/dump.rdb: $(wc -c <deploy/dump.rdb) bytes"
rcli GRAPH.LIST
