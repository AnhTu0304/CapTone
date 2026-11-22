#!/usr/bin/env bash
# ==============================================================================
# Encrypted PostgreSQL Restore & Verification Script (Sprint C Phase 3 + SD-04)
# Verifies SHA-256 checksum BEFORE decryption, decrypts AES-256-PBKDF2 archive,
# and restores into TARGET_DB (refuses overwriting captone_db or active DB_NAME
# unless --confirm-overwrite is supplied).
# Usage: ./scripts/restore-postgres.sh <ENCRYPTED_BACKUP_FILE> <TARGET_DB> [--confirm-overwrite]
# ==============================================================================
set -euo pipefail

ENC_FILE="${1:-}"
TARGET_DB="${2:-}"
CONFIRM_FLAG="${3:-}"
DOCKER_COMPOSE_FILE="${DOCKER_COMPOSE_FILE:-}"
DOCKER_PG_SERVICE="${DOCKER_PG_SERVICE:-}"
DOCKER_COMPOSE_PROJECT="${DOCKER_COMPOSE_PROJECT:-}"

if [ -z "$ENC_FILE" ] || [ -z "$TARGET_DB" ]; then
  echo "Usage: $0 <encrypted_backup_file.dump.enc> <target_db> [--confirm-overwrite]" >&2
  exit 1
fi

if [ ! -f "$ENC_FILE" ]; then
  echo "❌ Encrypted backup file not found: $ENC_FILE" >&2
  exit 1
fi

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "❌ BACKUP_ENCRYPTION_KEY must be set in environment" >&2
  exit 1
fi

SHA_FILE="${ENC_FILE}.sha256"
if [ ! -f "$SHA_FILE" ]; then
  echo "❌ Integrity manifest missing: $SHA_FILE" >&2
  exit 1
fi

echo "🔍 Verifying backup SHA-256 integrity..."
ENC_DIR="$(dirname "$ENC_FILE")"
ENC_BASE="$(basename "$ENC_FILE")"
SHA_BASE="$(basename "$SHA_FILE")"
if command -v sha256sum >/dev/null 2>&1; then
  if grep -qE "[[:space:]]${ENC_BASE}\$" "$SHA_FILE"; then
    (cd "$ENC_DIR" && sha256sum -c "$SHA_BASE")
  else
    EXPECTED="$(awk '{print $1}' "$SHA_FILE")"
    ACTUAL="$(sha256sum "$ENC_FILE" | awk '{print $1}')"
    if [ "$EXPECTED" != "$ACTUAL" ]; then
      echo "❌ Checksum mismatch! Expected=$EXPECTED Actual=$ACTUAL" >&2
      exit 1
    fi
  fi
else
  EXPECTED="$(awk '{print $1}' "$SHA_FILE")"
  ACTUAL="$(openssl dgst -sha256 "$ENC_FILE" | awk '{print $NF}')"
  if [ "$EXPECTED" != "$ACTUAL" ]; then
    echo "❌ Checksum mismatch! Expected=$EXPECTED Actual=$ACTUAL" >&2
    exit 1
  fi
fi

PROTECTED_DB="${DB_NAME:-captone_db}"
if { [ "$TARGET_DB" = "captone_db" ] || [ "$TARGET_DB" = "$PROTECTED_DB" ]; } && [ "$CONFIRM_FLAG" != "--confirm-overwrite" ]; then
  echo "❌ Refusing to overwrite protected database '$TARGET_DB' without explicit --confirm-overwrite flag" >&2
  exit 1
fi

umask 077
TMP_DUMP="$(mktemp "/tmp/.restore_${TARGET_DB}.dump.XXXXXX")"
cleanup() {
  rm -f "$TMP_DUMP"
}
trap cleanup EXIT

echo "🔓 Decrypting backup archive..."
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 \
  -in "$ENC_FILE" -out "$TMP_DUMP" -pass env:BACKUP_ENCRYPTION_KEY

PG_RESTORE_USER="${DB_MIGRATOR_USER:-${DB_USER:-postgres}}"

if [ -n "$DOCKER_COMPOSE_FILE" ] && [ -n "$DOCKER_PG_SERVICE" ]; then
  COMPOSE_ARGS=(-f "$DOCKER_COMPOSE_FILE")
  if [ -n "$DOCKER_COMPOSE_PROJECT" ]; then
    COMPOSE_ARGS=(-p "$DOCKER_COMPOSE_PROJECT" "${COMPOSE_ARGS[@]}")
  fi
  echo "♻️ Restoring into container database '$TARGET_DB' (${DOCKER_PG_SERVICE})..."
  docker compose "${COMPOSE_ARGS[@]}" exec -T "$DOCKER_PG_SERVICE" \
    pg_restore -U "$PG_RESTORE_USER" --clean --if-exists --no-owner --no-privileges -d "$TARGET_DB" < "$TMP_DUMP"
  RESTORED_TABLES="$(docker compose "${COMPOSE_ARGS[@]}" exec -T "$DOCKER_PG_SERVICE" \
    psql -U "$PG_RESTORE_USER" -d "$TARGET_DB" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
else
  export PGHOST="${DB_HOST:-localhost}"
  export PGPORT="${DB_PORT:-5432}"
  export PGUSER="$PG_RESTORE_USER"
  export PGSSLMODE="${PGSSLMODE:-verify-full}"
  if [ -n "${PGSSLROOTCERT:-${DB_SSL_CA_PATH:-}}" ]; then
    export PGSSLROOTCERT="${PGSSLROOTCERT:-${DB_SSL_CA_PATH:-}}"
  fi

  echo "♻️ Restoring into target database '$TARGET_DB'..."
  pg_restore --clean --if-exists --no-owner --no-privileges -d "$TARGET_DB" "$TMP_DUMP"
  RESTORED_TABLES="$(psql -d "$TARGET_DB" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
fi

RESTORED_TABLES="$(echo "$RESTORED_TABLES" | tr -d '[:space:]')"
echo "✅ Restore completed & verified ($RESTORED_TABLES tables in schema public of '$TARGET_DB')"
