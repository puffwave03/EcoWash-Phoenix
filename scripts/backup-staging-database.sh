#!/usr/bin/env bash

set -euo pipefail
export LC_ALL=C

readonly EXPECTED_PROJECT_REF="exthnplfokcucaqydney"
readonly REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
readonly LINKED_REF_FILE="${REPOSITORY_ROOT}/supabase/.temp/project-ref"

if [[ $# -ne 1 || "$1" != /* ]]; then
  echo "Usage: $0 /absolute/path/to/secure-backup-root" >&2
  exit 2
fi

if [[ ! -f "${LINKED_REF_FILE}" ]]; then
  echo "Supabase project is not linked; refusing to choose a target." >&2
  exit 1
fi

IFS= read -r LINKED_PROJECT_REF < "${LINKED_REF_FILE}"
if [[ "${LINKED_PROJECT_REF}" != "${EXPECTED_PROJECT_REF}" ]]; then
  echo "Refusing backup: linked Supabase ref is not the approved staging target." >&2
  exit 1
fi

BACKUP_ROOT="$1"
case "${BACKUP_ROOT}" in
  "${REPOSITORY_ROOT}"|"${REPOSITORY_ROOT}"/*)
    echo "Backup root must be outside the repository." >&2
    exit 1
    ;;
esac

for REQUIRED_COMMAND in docker git iconv shasum supabase; do
  command -v "${REQUIRED_COMMAND}" >/dev/null || {
    echo "Required command is unavailable: ${REQUIRED_COMMAND}" >&2
    exit 1
  }
done

docker info >/dev/null

umask 077
mkdir -p "${BACKUP_ROOT}"
BACKUP_ROOT="$(cd "${BACKUP_ROOT}" && pwd -P)"
case "${BACKUP_ROOT}" in
  "${REPOSITORY_ROOT}"|"${REPOSITORY_ROOT}"/*)
    echo "Backup root resolves inside the repository." >&2
    exit 1
    ;;
esac
readonly STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
readonly STARTED_EPOCH="$(date -u +%s)"
readonly BACKUP_TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
readonly BACKUP_DIRECTORY="${BACKUP_ROOT}/ecowash-phoenix-staging-${EXPECTED_PROJECT_REF}-${BACKUP_TIMESTAMP}"
mkdir "${BACKUP_DIRECTORY}"
chmod 700 "${BACKUP_DIRECTORY}"

readonly ROLES_FILE="${BACKUP_DIRECTORY}/roles.sql"
readonly SCHEMA_FILE="${BACKUP_DIRECTORY}/schema.sql"
readonly DATA_FILE="${BACKUP_DIRECTORY}/data.sql"
readonly METADATA_FILE="${BACKUP_DIRECTORY}/backup-metadata.txt"
readonly CHECKSUM_FILE="${BACKUP_DIRECTORY}/SHA256SUMS"

supabase db dump --linked --role-only --file "${ROLES_FILE}"
supabase db dump --linked --schema public --file "${SCHEMA_FILE}"
supabase db dump --linked --data-only --schema public --use-copy --file "${DATA_FILE}"
chmod 600 "${ROLES_FILE}" "${SCHEMA_FILE}" "${DATA_FILE}"

for ARTIFACT in "${ROLES_FILE}" "${SCHEMA_FILE}" "${DATA_FILE}"; do
  test -s "${ARTIFACT}"
  iconv -f UTF-8 -t UTF-8 "${ARTIFACT}" >/dev/null
  awk 'NF { last = $0 } END { exit(last ~ /^\\unrestrict / ? 0 : 1) }' "${ARTIFACT}"
done

readonly ROLE_STATEMENTS="$(awk '/^CREATE ROLE / || /^ALTER ROLE / { count++ } END { print count + 0 }' "${ROLES_FILE}")"
readonly SCHEMA_TABLES="$(awk '/^CREATE TABLE / { count++ } END { print count + 0 }' "${SCHEMA_FILE}")"
readonly SCHEMA_GRANTS="$(awk '/^GRANT / { count++ } END { print count + 0 }' "${SCHEMA_FILE}")"
readonly DATA_COPY_SECTIONS="$(awk '/^COPY / { count++ } END { print count + 0 }' "${DATA_FILE}")"
readonly DATA_COPY_TERMINATORS="$(awk '/^\\\.$/ { count++ } END { print count + 0 }' "${DATA_FILE}")"
[[ "${ROLE_STATEMENTS}" -gt 0 ]]
[[ "${SCHEMA_TABLES}" -gt 0 ]]
[[ "${SCHEMA_GRANTS}" -gt 0 ]]
[[ "${DATA_COPY_SECTIONS}" -gt 0 ]]
[[ "${DATA_COPY_SECTIONS}" -eq "${DATA_COPY_TERMINATORS}" ]]

readonly FINISHED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
readonly FINISHED_EPOCH="$(date -u +%s)"
readonly DURATION_SECONDS="$((FINISHED_EPOCH - STARTED_EPOCH))"
readonly BRANCH="$(git -C "${REPOSITORY_ROOT}" branch --show-current)"
readonly HEAD_SHA="$(git -C "${REPOSITORY_ROOT}" rev-parse HEAD)"
if [[ -z "$(git -C "${REPOSITORY_ROOT}" status --porcelain)" ]]; then
  readonly WORKTREE_STATE="clean"
else
  readonly WORKTREE_STATE="dirty"
fi
readonly SUPABASE_CLI_VERSION="$(supabase --version)"
readonly DOCKER_VERSION="$(docker version --format 'client={{.Client.Version}} server={{.Server.Version}}')"
readonly ROLES_SIZE="$(wc -c < "${ROLES_FILE}" | tr -d ' ')"
readonly SCHEMA_SIZE="$(wc -c < "${SCHEMA_FILE}" | tr -d ' ')"
readonly DATA_SIZE="$(wc -c < "${DATA_FILE}" | tr -d ' ')"

printf '%s\n' \
  "backup_task=BACKUP-DR-001A" \
  "project_ref=${EXPECTED_PROJECT_REF}" \
  "started_at_utc=${STARTED_AT}" \
  "finished_at_utc=${FINISHED_AT}" \
  "duration_seconds=${DURATION_SECONDS}" \
  "branch=${BRANCH}" \
  "head=${HEAD_SHA}" \
  "worktree=${WORKTREE_STATE}" \
  "supabase_cli=${SUPABASE_CLI_VERSION}" \
  "docker=${DOCKER_VERSION}" \
  "roles.sql.bytes=${ROLES_SIZE}" \
  "schema.sql.bytes=${SCHEMA_SIZE}" \
  "data.sql.bytes=${DATA_SIZE}" \
  "coverage=roles plus public schema/grants plus public application data" \
  "excluded=managed Auth data, Storage schema/objects/files, environment variables, secrets, platform configuration, logs, and PITR" \
  > "${METADATA_FILE}"
chmod 600 "${METADATA_FILE}"

(
  cd "${BACKUP_DIRECTORY}"
  shasum -a 256 roles.sql schema.sql data.sql backup-metadata.txt > SHA256SUMS
  chmod 600 SHA256SUMS
  shasum -a 256 -c SHA256SUMS
)

echo "Staging logical backup completed: ${BACKUP_DIRECTORY}"
