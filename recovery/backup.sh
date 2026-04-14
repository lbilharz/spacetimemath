#!/usr/bin/env bash
# backup.sh — export all durable SpacetimeDB tables to a timestamped directory.
#
# Usage: bash recovery/backup.sh
# Run this before any risky schema-breaking publish to preserve production data.

set -euo pipefail

SPACETIME=/Users/lbi/.local/bin/spacetime
DB=spacetimemath
SERVER=maincloud

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTDIR="$SCRIPT_DIR/backups/$(date +%Y-%m-%d_%H-%M-%S)"

mkdir -p "$OUTDIR"

TABLES=(
  # Core player data
  players
  player_secrets
  best_scores
  player_dkt_weights
  unlock_logs
  # Auth & admin
  recovery_keys
  server_admins
  teacher_secrets
  # Session history
  sessions
  answers
  problem_stats
  kc_telemetry
  # Social
  friendships
  friend_invites
  # Classroom
  classrooms
  classroom_members
  class_sprints
)

for TABLE in "${TABLES[@]}"; do
  $SPACETIME sql $DB "SELECT * FROM $TABLE" --server $SERVER 2>/dev/null > "$OUTDIR/$TABLE.txt"
  echo "  [OK] $TABLE -> $OUTDIR/$TABLE.txt"
done

echo "Backup complete: $OUTDIR"
