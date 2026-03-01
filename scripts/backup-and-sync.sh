#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/Users/michael/gst-backbone-work"
BACKUP_DIR="${HOME}/Desktop/gst-backups"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/gst-backbone-work-${TS}.tar.gz"
COMMIT_MSG="${1:-chore: sync latest local changes}"

mkdir -p "${BACKUP_DIR}"

cd "${REPO_DIR}"

tar \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='supabase/.temp' \
  --exclude='*.log' \
  -czf "${BACKUP_FILE}" .

echo "Backup created: ${BACKUP_FILE}"

git add -A
if git diff --cached --quiet; then
  echo "No staged changes to commit."
else
  git commit -m "${COMMIT_MSG}"
fi

git pull --rebase origin main
git push origin main

echo "Sync complete."
