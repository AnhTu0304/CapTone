#!/usr/bin/env bash
# ==============================================================================
# Encrypted PostgreSQL Backup Script (Sprint C Phase 3 + Sprint D SD-04)
# Supports both direct TLS pg_dump (PGSSLMODE=verify-full) and internal
# Docker Compose container execution (DOCKER_COMPOSE_FILE + DOCKER_PG_SERVICE).
# Encrypts dump with AES-256-CBC PBKDF2-SHA256, writes portable basename SHA-256
# manifest, enforces umask 077, prunes local retention, and invokes optional
# off-host replication hook (BACKUP_OFFHOST_CMD).
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/selfheal}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-captone_db}"
DB_BACKUP_USER="${DB_BACKUP_USER:-${DB_USER:-postgres}}"
PGSSLMODE="${PGSSLMODE:-verify-full}"
PGSSLROOTCERT="${PGSSLROOTCERT:-${DB_SSL_CA_PATH:-}}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
DOCKER_COMPOSE_FILE="${DOCKER_COMPOSE_FILE:-}"
DOCKER_PG_SERVICE="${DOCKER_PG_SERVICE:-}"
DOCKER_COMPOSE_PROJECT="${DOCKER_COMPOSE_PROJECT:-}"
BACKUP_OFFHOST_CMD="${BACKUP_OFFHOST_CMD:-}"

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ] || [ "${#BACKUP_ENCRYPTION_KEY}" -lt 24 ]; then
  echo "❌ ERROR: BACKUP_ENCRYPTION_KEY (>= 24 chars) must be set in environment" >&2
  exit 1
fi

umask 077
mkdir -p "$BACKUP_DIR"
chmod 0700 "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RAW_DUMP="$(mktemp "${BACKUP_DIR}/.${DB_NAME}_${STAMP}.dump.XXXXXX")"
ENC_FILE="${BACKUP_DIR}/${DB_NAME}_${STAMP}.dump.enc"
SHA_FILE="${ENC_FILE}.sha256"

cleanup() {
  rm -f "$RAW_DUMP"
}
trap cleanup EXIT

if [ -n "$DOCKER_COMPOSE_FILE" ] && [ -n "$DOCKER_PG_SERVICE" ]; then
  COMPOSE_ARGS=(-f "$DOCKER_COMPOSE_FILE")
  if [ -n "$DOCKER_COMPOSE_PROJECT" ]; then
    COMPOSE_ARGS=(-p "$DOCKER_COMPOSE_PROJECT" "${COMPOSE_ARGS[@]}")
  fi
  echo "🔒 Starting container-internal pg_dump (${DOCKER_PG_SERVICE}) for database '$DB_NAME'..."
  docker compose "${COMPOSE_ARGS[@]}" exec -T "$DOCKER_PG_SERVICE" \
    pg_dump -U "$DB_BACKUP_USER" -Fc -Z 6 --no-owner --no-privileges "$DB_NAME" > "$RAW_DUMP"
else
  export PGHOST="$DB_HOST"
  export PGPORT="$DB_PORT"
  export PGUSER="$DB_BACKUP_USER"
  export PGDATABASE="$DB_NAME"
  export PGSSLMODE="$PGSSLMODE"
  if [ -n "$PGSSLROOTCERT" ]; then
    export PGSSLROOTCERT="$PGSSLROOTCERT"
  fi
  echo "🔒 Starting TLS-protected pg_dump (sslmode=$PGSSLMODE) for database '$DB_NAME'..."
  pg_dump -Fc -Z 6 --no-owner --no-privileges -f "$RAW_DUMP" "$DB_NAME"
fi

if [ ! -s "$RAW_DUMP" ]; then
  echo "❌ ERROR: pg_dump produced empty archive: $RAW_DUMP" >&2
  exit 1
fi

echo "🔐 Encrypting backup archive with AES-256-PBKDF2..."
openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -md sha256 \
  -in "$RAW_DUMP" -out "$ENC_FILE" -pass env:BACKUP_ENCRYPTION_KEY
chmod 0600 "$ENC_FILE"
rm -f "$RAW_DUMP"

# Write portable basename checksum so sha256sum -c passes across hosts/directories
ENC_DIR="$(dirname "$ENC_FILE")"
ENC_BASE="$(basename "$ENC_FILE")"
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$ENC_DIR" && sha256sum "$ENC_BASE") > "$SHA_FILE"
else
  SUM_HEX="$(openssl dgst -sha256 "$ENC_FILE" | awk '{print $NF}')"
  printf '%s  %s\n' "$SUM_HEX" "$ENC_BASE" > "$SHA_FILE"
fi
chmod 0600 "$SHA_FILE"

if [ -n "$BACKUP_OFFHOST_CMD" ]; then
  echo "☁️ Invoking off-host backup sync hook..."
  ENC_FILE="$ENC_FILE" SHA_FILE="$SHA_FILE" sh -c "$BACKUP_OFFHOST_CMD"
fi

if [ "$RETENTION_DAYS" -gt 0 ] 2>/dev/null; then
  find "$BACKUP_DIR" -maxdepth 1 -type f \( -name "${DB_NAME}_*.dump.enc" -o -name "${DB_NAME}_*.dump.enc.sha256" \) -mtime "+${RETENTION_DAYS}" -delete
fi

echo "✅ Encrypted backup created: $ENC_FILE"
echo "✅ Checksum written: $SHA_FILE"
