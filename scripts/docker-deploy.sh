#!/usr/bin/env sh
set -eu

REMOTE="origin"
BRANCH="main"
NO_CACHE="0"
PULL_IMAGES="0"
SKIP_HEALTH="0"
HEALTH_TIMEOUT_SECONDS="120"

usage() {
  cat <<'EOF'
Usage: ./scripts/docker-deploy.sh [options]

Pull the latest Git code, detect what changed, and rebuild only the affected
Docker services.

Options:
  --remote NAME             Git remote. Default: origin
  --branch NAME             Git branch. Default: main
  --no-cache                Build without Docker cache
  --pull                    Pull newer base images while building
  --skip-health-check       Do not wait for API health check
  --health-timeout SECONDS  API health timeout. Default: 120
  -h, --help                Show help
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --remote)
      REMOTE="${2:-origin}"
      shift 2
      ;;
    --branch)
      BRANCH="${2:-main}"
      shift 2
      ;;
    --no-cache)
      NO_CACHE="1"
      shift
      ;;
    --pull)
      PULL_IMAGES="1"
      shift
      ;;
    --skip-health-check)
      SKIP_HEALTH="1"
      shift
      ;;
    --health-timeout)
      HEALTH_TIMEOUT_SECONDS="${2:-120}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
cd "$PROJECT_ROOT"

run() {
  echo
  echo "> $*"
  "$@"
}

if [ ! -d .git ]; then
  echo "This directory is not a Git repository. Clone the project from GitHub first." >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo ".env was not found. Copy .env.docker.example to .env and edit it before deploying." >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Local code has uncommitted changes. Commit, stash, or discard them before fast deploy." >&2
  git status --short
  exit 1
fi

CURRENT_HEAD=$(git rev-parse HEAD)

run git fetch "$REMOTE" "$BRANCH"
REMOTE_HEAD=$(git rev-parse FETCH_HEAD)

if [ "$CURRENT_HEAD" = "$REMOTE_HEAD" ]; then
  echo
  echo "Code is already up to date. No Docker rebuild needed."
  run docker compose ps
  exit 0
fi

CHANGED_FILE_LIST=$(mktemp)
git diff --name-only "$CURRENT_HEAD" "$REMOTE_HEAD" > "$CHANGED_FILE_LIST"

NEEDS_WEB="0"
NEEDS_API="0"
NEEDS_COMPOSE_UP="0"

echo
echo "Changed files:"
sed 's/^/  - /' "$CHANGED_FILE_LIST"

while IFS= read -r file; do
  case "$file" in
    apps/web/*|Dockerfile.web)
      NEEDS_WEB="1"
      ;;
    apps/api/*|Dockerfile.api)
      NEEDS_API="1"
      ;;
    packages/shared/*|package.json|package-lock.json|tsconfig.base.json)
      NEEDS_WEB="1"
      NEEDS_API="1"
      ;;
    docker-compose.yml)
      NEEDS_WEB="1"
      NEEDS_API="1"
      NEEDS_COMPOSE_UP="1"
      ;;
    .env.docker.example|.dockerignore|.gitignore|README.md|docs/*|scripts/*)
      ;;
    *)
      NEEDS_WEB="1"
      NEEDS_API="1"
      ;;
  esac
done < "$CHANGED_FILE_LIST"

rm -f "$CHANGED_FILE_LIST"

run git merge --ff-only FETCH_HEAD

if [ "$NEEDS_WEB" = "0" ] && [ "$NEEDS_API" = "0" ]; then
  if [ "$NEEDS_COMPOSE_UP" = "1" ]; then
    run docker compose up -d --remove-orphans
  else
    echo
    echo "Only docs/scripts/config examples changed. No Docker rebuild needed."
  fi
  run docker compose ps
  exit 0
fi

UPDATE_ARGS=""
if [ "$NEEDS_WEB" = "1" ] && [ "$NEEDS_API" = "0" ]; then
  UPDATE_ARGS="$UPDATE_ARGS --service web"
elif [ "$NEEDS_WEB" = "0" ] && [ "$NEEDS_API" = "1" ]; then
  UPDATE_ARGS="$UPDATE_ARGS --service api"
fi
if [ "$NO_CACHE" = "1" ]; then
  UPDATE_ARGS="$UPDATE_ARGS --no-cache"
fi
if [ "$PULL_IMAGES" = "1" ]; then
  UPDATE_ARGS="$UPDATE_ARGS --pull"
fi
if [ "$SKIP_HEALTH" = "1" ]; then
  UPDATE_ARGS="$UPDATE_ARGS --skip-health-check"
fi
UPDATE_ARGS="$UPDATE_ARGS --health-timeout $HEALTH_TIMEOUT_SECONDS"

# shellcheck disable=SC2086
run sh "$SCRIPT_DIR/docker-update.sh" $UPDATE_ARGS
