#!/usr/bin/env bash

set -Eeuo pipefail
export LC_ALL=C

SERVER_BASE_FOLDER="${1:?server base folder is required}"
PROJECT_FOLDER="${2:?project folder is required}"
TEMP_UPLOAD_FOLDER="${3:?temp upload folder is required}"
ZIP_FILENAME="${4:?zip filename is required}"
RETENTION_DAYS="${5:-60}"
RELEASE_ID="${6:-manual}"

if [[ "$SERVER_BASE_FOLDER" != /* ]]; then
  echo "ERROR: server base folder must be absolute: $SERVER_BASE_FOLDER" >&2
  exit 1
fi

if [[ ! "$RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
  echo "ERROR: retention days must be a positive integer: $RETENTION_DAYS" >&2
  exit 1
fi

if ((RETENTION_DAYS < 1)); then
  echo "ERROR: retention days must be greater than 0" >&2
  exit 1
fi

validate_folder_name() {
  local label="$1"
  local value="$2"

  case "$value" in
    "" | "." | ".." | /* | */* | *".."*)
      echo "ERROR: $label must be a plain folder name: $value" >&2
      exit 1
      ;;
  esac
}

validate_file_name() {
  local label="$1"
  local value="$2"

  case "$value" in
    "" | "." | ".." | /* | */* | *".."*)
      echo "ERROR: $label must be a plain file name: $value" >&2
      exit 1
      ;;
  esac
}

validate_folder_name "project folder" "$PROJECT_FOLDER"
validate_folder_name "temp upload folder" "$TEMP_UPLOAD_FOLDER"
validate_file_name "zip filename" "$ZIP_FILENAME"

BASE_DIR="${SERVER_BASE_FOLDER%/}"
LIVE_DIR="$BASE_DIR/$PROJECT_FOLDER"
UPLOAD_DIR="$BASE_DIR/$TEMP_UPLOAD_FOLDER"
ZIP_PATH="$UPLOAD_DIR/$ZIP_FILENAME"
META_DIR="$BASE_DIR/.$PROJECT_FOLDER-deploy-meta"
MANIFEST_DIR="$META_DIR/manifests"
LOCK_DIR="$META_DIR/deploy.lock"
LOCK_WAIT_SECONDS=300
LOCK_HELD=0

# Per-run working state. Created under the exclusive lock via mktemp so
# concurrent invocations never share (and clobber) each other's extraction
# dir or manifests. Empty until acquire_lock succeeds; cleanup guards on that.
WORK_DIR=""
RELEASE_DIR=""
RELEASE_MANIFEST=""
KEEP_MANIFEST=""
DELETE_CANDIDATES=""
DELETE_MANIFEST=""

log() {
  printf '%s\n' "$*"
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  if ((LOCK_HELD)); then
    rm -rf "$LOCK_DIR"
  fi

  # Only remove this run's own working dir. Never touch the shared upload
  # dir here: a waiter that timed out (or any early exit) must not delete
  # the lock holder's in-flight release/manifests.
  if [[ -n "$WORK_DIR" ]]; then
    rm -rf "$WORK_DIR"
  fi
}

is_index_file() {
  case "$1" in
    index.html | */index.html | index.html.br | */index.html.br | index.html.gz | */index.html.gz)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_immutable_asset() {
  local path="$1"

  if [[ "$path" =~ (^|/)(chunk|main|polyfills|runtime|scripts|styles)-[A-Za-z0-9_-]{8,}\.(js|css|mjs|wasm)(\.map)?(\.br|\.gz)?$ ]]; then
    return 0
  fi

  if [[ "$path" =~ (^|/)media/[^/]+-[A-Za-z0-9_-]{8,}\.(woff2?|ttf|otf|eot|svg|png|jpg|jpeg|gif|webp|avif|mp4|webm)(\.br|\.gz)?$ ]]; then
    return 0
  fi

  return 1
}

manifest_release() {
  (
    cd "$RELEASE_DIR"
    find . -type f | sed 's#^\./##' | sort >"$RELEASE_MANIFEST"
  )
}

bootstrap_existing_assets_manifest() {
  local bootstrap_manifest
  local file_path
  local relative_path

  if [[ -f "$META_DIR/current-files.txt" ]] || find "$MANIFEST_DIR" -type f -print -quit | grep -q .; then
    return
  fi

  bootstrap_manifest="$MANIFEST_DIR/$(date -u '+%Y%m%dT%H%M%SZ')-bootstrap-existing-assets.txt"
  : >"$bootstrap_manifest"

  while IFS= read -r -d '' file_path; do
    relative_path="${file_path#"$LIVE_DIR"/}"
    is_immutable_asset "$relative_path" || continue
    printf '%s\n' "$relative_path" >>"$bootstrap_manifest"
  done < <(find "$LIVE_DIR" -type f -print0)

  sort -u "$bootstrap_manifest" -o "$bootstrap_manifest"
  log "Bootstrapped existing immutable assets: $bootstrap_manifest"
}

validate_zip_entries() {
  local entry

  while IFS= read -r entry; do
    case "$entry" in
      "" | .. | /* | ../* | */../* | */..)
        fail "zip contains unsafe path: $entry"
        ;;
    esac
  done < <(unzip -Z1 "$ZIP_PATH")
}

copy_file_atomic() {
  local relative_path="$1"
  local source_path="$RELEASE_DIR/$relative_path"
  local target_path="$LIVE_DIR/$relative_path"
  local target_dir
  local temp_target

  target_dir="$(dirname "$target_path")"
  mkdir -p "$target_dir"

  if [[ -e "$target_path" && ! -f "$target_path" ]]; then
    fail "target exists and is not a file: $target_path"
  fi

  if [[ -f "$target_path" ]] && cmp -s "$source_path" "$target_path"; then
    return
  fi

  temp_target="$target_dir/.deploy-tmp-$(basename "$target_path").$$"
  rm -f "$temp_target"
  cp -p "$source_path" "$temp_target"
  mv -f "$temp_target" "$target_path"
}

check_immutable_collisions() {
  local relative_path
  local source_path
  local target_path

  while IFS= read -r relative_path; do
    is_immutable_asset "$relative_path" || continue

    source_path="$RELEASE_DIR/$relative_path"
    target_path="$LIVE_DIR/$relative_path"

    if [[ -e "$target_path" && ! -f "$target_path" ]]; then
      fail "immutable asset target exists and is not a file: $target_path"
    fi

    if [[ -f "$target_path" ]] && ! cmp -s "$source_path" "$target_path"; then
      fail "immutable asset collision with different bytes: $relative_path"
    fi
  done <"$RELEASE_MANIFEST"
}

copy_release_assets() {
  local relative_path

  while IFS= read -r relative_path; do
    is_index_file "$relative_path" && continue
    copy_file_atomic "$relative_path"
  done <"$RELEASE_MANIFEST"

  while IFS= read -r relative_path; do
    is_index_file "$relative_path" || continue
    copy_file_atomic "$relative_path"
  done <"$RELEASE_MANIFEST"
}

save_manifest() {
  local safe_release_id
  local manifest_path

  safe_release_id="$(printf '%s' "$RELEASE_ID" | tr -c 'A-Za-z0-9._-' '-')"
  manifest_path="$MANIFEST_DIR/$(date -u '+%Y%m%dT%H%M%SZ')-$safe_release_id.txt"

  cp "$RELEASE_MANIFEST" "$manifest_path"
  cp "$RELEASE_MANIFEST" "$META_DIR/current-files.txt"
  log "Saved manifest: $manifest_path"
}

build_keep_manifest() {
  : >"$KEEP_MANIFEST"

  if [[ -f "$META_DIR/current-files.txt" ]]; then
    cat "$META_DIR/current-files.txt" >>"$KEEP_MANIFEST"
  fi

  if [[ -d "$MANIFEST_DIR" ]]; then
    find "$MANIFEST_DIR" -type f -mtime "-$RETENTION_DAYS" -print0 |
      while IFS= read -r -d '' manifest_path; do
        cat "$manifest_path" >>"$KEEP_MANIFEST"
      done
  fi

  sort -u "$KEEP_MANIFEST" -o "$KEEP_MANIFEST"
}

cleanup_retained_assets() {
  local deleted_count=0
  local file_path
  local relative_path

  build_keep_manifest
  : >"$DELETE_CANDIDATES"

  while IFS= read -r -d '' file_path; do
    relative_path="${file_path#"$LIVE_DIR"/}"
    is_immutable_asset "$relative_path" || continue
    printf '%s\n' "$relative_path" >>"$DELETE_CANDIDATES"
  done < <(find "$LIVE_DIR" -type f -mtime "+$RETENTION_DAYS" -print0)

  sort -u "$DELETE_CANDIDATES" -o "$DELETE_CANDIDATES"
  comm -23 "$DELETE_CANDIDATES" "$KEEP_MANIFEST" >"$DELETE_MANIFEST"

  while IFS= read -r relative_path; do
    [[ -n "$relative_path" ]] || continue
    rm -f "$LIVE_DIR/$relative_path"
    deleted_count=$((deleted_count + 1))
  done <"$DELETE_MANIFEST"

  if [[ -d "$MANIFEST_DIR" ]]; then
    find "$MANIFEST_DIR" -type f -mtime "+$RETENTION_DAYS" -exec rm -f {} +
  fi

  log "Cleanup done. deleted_immutable_assets=$deleted_count retention_days=$RETENTION_DAYS"
}

acquire_lock() {
  local waited=0

  trap cleanup EXIT
  mkdir -p "$META_DIR"

  until mkdir "$LOCK_DIR" 2>/dev/null; do
    if ((waited >= LOCK_WAIT_SECONDS)); then
      fail "deploy lock still held after ${LOCK_WAIT_SECONDS}s: $LOCK_DIR"
    fi

    sleep 5
    waited=$((waited + 5))
  done

  LOCK_HELD=1

  # Exclusive from here on. Allocate an isolated working dir so extraction
  # and manifest scratch files can never collide with another invocation.
  WORK_DIR="$(mktemp -d "$META_DIR/work.XXXXXXXX")"
  RELEASE_DIR="$WORK_DIR/release"
  RELEASE_MANIFEST="$WORK_DIR/release-files.txt"
  KEEP_MANIFEST="$WORK_DIR/keep-files.txt"
  DELETE_CANDIDATES="$WORK_DIR/delete-candidates.txt"
  DELETE_MANIFEST="$WORK_DIR/delete-files.txt"
}

main() {
  # Acquire the lock first, then re-check the zip under it. The upload dir is
  # shared, so its state is only trustworthy while we hold the lock.
  acquire_lock

  [[ -f "$ZIP_PATH" ]] || fail "upload zip not found: $ZIP_PATH"

  mkdir -p "$LIVE_DIR" "$MANIFEST_DIR"
  bootstrap_existing_assets_manifest
  mkdir -p "$RELEASE_DIR"

  validate_zip_entries
  unzip -q "$ZIP_PATH" -d "$RELEASE_DIR"

  [[ -f "$RELEASE_DIR/index.html" ]] || fail "release does not contain root index.html"

  manifest_release
  check_immutable_collisions
  copy_release_assets
  save_manifest
  cleanup_retained_assets

  # Consumed successfully while holding the lock: drop the zip so a retry
  # can't redeploy a stale artifact.
  rm -f "$ZIP_PATH"

  log "Deploy done. live_dir=$LIVE_DIR release_id=$RELEASE_ID"
}

main "$@"
