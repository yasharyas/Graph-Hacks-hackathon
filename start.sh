#!/bin/bash
# Container entrypoint (bash: the base image has it, and `wait -n` is the simplest "exit when either child exits").
#   FALKOR_HOST unset/127.0.0.1 -> start Redis+FalkorDB here (Render: one container, 512 MB).
#   FALKOR_HOST=<host>          -> use that server (docker compose); only the ACL users + graphs are set up.
# Secrets never appear in argv or logs: Redis gets only a SHA-256 hash (stdin config), redis-cli reads REDISCLI_AUTH.
set -eu

for v in REDIS_PASSWORD PZ_RO_PASSWORD PZ_RW_PASSWORD; do
  [ -n "${!v:-}" ] || { echo "start.sh: $v is required" >&2; exit 1; }
done

sha() { printf %s "$1" | sha256sum | cut -d' ' -f1; }

pids=""
cleanup() { [ -z "$pids" ] || { kill $pids 2>/dev/null || true; wait 2>/dev/null || true; }; }
trap 'exit 143' TERM INT # PID 1 ignores signals unless trapped
trap cleanup EXIT

if [ "${FALKOR_HOST:-127.0.0.1}" = 127.0.0.1 ]; then
  export FALKOR_HOST=127.0.0.1 FALKOR_PORT=6379
  # S8: loopback only. The default user's password is configured as a hash, so no --requirepass in argv.
  redis-server - --loadmodule /var/lib/falkordb/bin/falkordb.so \
    TIMEOUT_MAX 30000 TIMEOUT_DEFAULT 15000 RESULTSET_SIZE 50000 QUERY_MEM_CAPACITY 67108864 THREAD_COUNT 1 \
    --bind 127.0.0.1 --protected-mode yes --port 6379 --save "" --appendonly no --maxmemory 320mb \
    --dir /var/lib/falkordb/data <<<"user default on #$(sha "$REDIS_PASSWORD") ~* &* +@all" &
  pids=$!
else
  export FALKOR_PORT="${FALKOR_PORT:-6379}"
fi

export REDISCLI_AUTH="$REDIS_PASSWORD"
rcli() { redis-cli -h "$FALKOR_HOST" -p "$FALKOR_PORT" --no-auth-warning "$@"; }

i=0
until [ "$(rcli PING 2>/dev/null)" = PONG ]; do
  [ -z "$pids" ] || kill -0 $pids # local Redis died: fail now
  i=$((i + 1))
  [ "$i" -lt 300 ] || { echo "start.sh: FalkorDB at $FALKOR_HOST:$FALKOR_PORT not reachable" >&2; exit 1; }
  sleep 0.2
done

# S8: tools run as pz_ro (reads only); ingest and triage memory run as pz_rw. `reset` makes this idempotent.
RO='-@all +GRAPH.RO_QUERY +GRAPH.EXPLAIN +GRAPH.LIST +PING +HELLO +CLIENT +INFO'
rcli >/dev/null <<EOF
ACL SETUSER pz_ro reset on #$(sha "$PZ_RO_PASSWORD") ~* &* $RO
ACL SETUSER pz_rw reset on #$(sha "$PZ_RW_PASSWORD") ~* &* $RO +GRAPH.QUERY +GRAPH.DELETE +GRAPH.COPY +GRAPH.CONSTRAINT +GRAPH.MEMORY +SAVE
EOF
# A failed SETUSER leaves no user, so a failed login here means fail fast.
[ "$(REDISCLI_AUTH="$PZ_RO_PASSWORD" rcli --user pz_ro PING)" = PONG ] || { echo "start.sh: ACL user pz_ro not usable" >&2; exit 1; }
[ "$(REDISCLI_AUTH="$PZ_RW_PASSWORD" rcli --user pz_rw PING)" = PONG ] || { echo "start.sh: ACL user pz_rw not usable" >&2; exit 1; }

# No baked RDB (or an empty server): rebuild from the committed data/.
rcli GRAPH.LIST | grep -qx pz_acme_qix || node server/ingest/build.ts

node --max-old-space-size=160 server/index.ts &
pids="$pids $!"
wait -n # either child exiting ends the container so the platform restarts it
exit 1
