#!/usr/bin/env sh
set -eu

SERVICE="all"
NO_CACHE="0"
PULL="0"
SKIP_BUILD="0"
SKIP_HEALTH="0"
HEALTH_TIMEOUT_SECONDS="120"

usage() {
  cat <<'EOF'
Usage: ./scripts/docker-update.sh [options]

Options:
  --service all|api|web     Target service. Default: all
  --no-cache                Build without Docker cache
  --pull                    Pull newer base images while building
  --skip-build              Recreate containers without rebuilding images
  --skip-health-check       Do not wait for API health check
  --health-timeout SECONDS  API health timeout. Default: 120
  -h, --help                Show help
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --service)
      SERVICE="${2:-}"
      shift 2
      ;;
    --no-cache)
      NO_CACHE="1"
      shift
      ;;
    --pull)
      PULL="1"
      shift
      ;;
    --skip-build)
      SKIP_BUILD="1"
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

case "$SERVICE" in
  all) TARGETS="api web" ;;
  api) TARGETS="api" ;;
  web) TARGETS="web" ;;
  *)
    echo "--service must be all, api, or web." >&2
    exit 1
    ;;
esac

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
cd "$PROJECT_ROOT"

if [ ! -f docker-compose.yml ]; then
  echo "docker-compose.yml was not found. Run this script from the ParentBond project." >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo ".env was not found. Copy .env.docker.example to .env and edit it before deploying." >&2
  exit 1
fi

run() {
  echo
  echo "> $*"
  "$@"
}

test_api_health() {
  docker compose exec -T api node -e "fetch('http://127.0.0.1:3000/api/v1/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1
}

wait_for_api_health() {
  echo
  echo "Waiting for API health check..."
  END_TIME=$(( $(date +%s) + HEALTH_TIMEOUT_SECONDS ))

  while [ "$(date +%s)" -lt "$END_TIME" ]; do
    if test_api_health; then
      echo "API health check passed."
      return 0
    fi
    sleep 3
  done

  echo "API health check did not pass within ${HEALTH_TIMEOUT_SECONDS} seconds. Run 'docker compose logs -f api' for details." >&2
  return 1
}

get_env_value() {
  NAME="$1"
  DEFAULT_VALUE="$2"
  VALUE=$(grep -E "^${NAME}=" .env 2>/dev/null | head -n 1 | sed "s/^${NAME}=//" || true)
  if [ -z "$VALUE" ]; then
    echo "$DEFAULT_VALUE"
  else
    VALUE=${VALUE#\"}
    VALUE=${VALUE%\"}
    VALUE=${VALUE#\'}
    VALUE=${VALUE%\'}
    printf '%s\n' "$VALUE"
  fi
}

echo "ParentBond Docker update"
echo "Project: $PROJECT_ROOT"
echo "Target:  $TARGETS"

run docker --version
run docker compose version

if [ "$SKIP_BUILD" = "0" ]; then
  BUILD_ARGS=""
  if [ "$PULL" = "1" ]; then
    BUILD_ARGS="$BUILD_ARGS --pull"
  fi
  if [ "$NO_CACHE" = "1" ]; then
    BUILD_ARGS="$BUILD_ARGS --no-cache"
  fi
  # shellcheck disable=SC2086
  run docker compose build $BUILD_ARGS $TARGETS
fi

# shellcheck disable=SC2086
run docker compose up -d --remove-orphans $TARGETS

if [ "$SKIP_HEALTH" = "0" ]; then
  wait_for_api_health
fi

run docker compose ps

WEB_PORT=$(get_env_value "WEB_PORT" "8080")
echo
echo "Update finished. Open: http://localhost:${WEB_PORT}"
echo "For logs: docker compose logs -f api web"
