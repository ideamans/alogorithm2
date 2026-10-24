#!/bin/bash
# Build the production Docker image and check its behavior:
#   1. run the unit/HTTP/golden test suite (ava) inside the image (Linux, same Node.js as production)
#   2. start the container as in production (`yarn start`) and request every endpoint over HTTP
#
# Usage: ./scripts/docker-smoke.sh [image-tag]   (default tag: alogorithm2:smoke)
set -euo pipefail

cd "$(dirname "$0")/.."

IMAGE=${1:-alogorithm2:smoke}
PORT=${SMOKE_PORT:-13001}
NAME=alogorithm2-smoke-$$
TMP=$(mktemp -d)

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

echo "==> docker build -t $IMAGE ."
docker build -t "$IMAGE" .

echo "==> Running test suite inside the image"
docker run --rm "$IMAGE" sh -c 'yarn -s build && yarn -s test:unit'

echo "==> Starting container on port $PORT"
docker run -d --name "$NAME" -p "127.0.0.1:$PORT:3001" "$IMAGE" >/dev/null

for _ in $(seq 1 120); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/v2/icon.svg" 2>/dev/null; then break; fi
  sleep 1
done

fail=0
check() {
  local path=$1 type=$2
  local out="$TMP/out"
  local ctype
  ctype=$(curl -fsS -o "$out" -w '%{content_type}' "http://127.0.0.1:$PORT$path") || {
    echo "NG   $path (request failed)"
    fail=1
    return
  }
  if [ "$ctype" != "$type" ]; then
    echo "NG   $path content-type=$ctype"
    fail=1
    return
  fi
  if [ "$type" = image/png ]; then
    # PNG signature + IHDR width/height
    local sig wh
    sig=$(head -c 8 "$out" | od -An -tx1 | tr -d ' \n')
    wh=$(od -An -tu1 -j16 -N8 "$out" | awk 'NF {print $1*16777216+$2*65536+$3*256+$4 "x" $5*16777216+$6*65536+$7*256+$8}')
    if [ "$sig" != 89504e470d0a1a0a ]; then
      echo "NG   $path not a PNG"
      fail=1
      return
    fi
    echo "OK   $path ($ctype, ${wh})"
  else
    if ! head -c 5 "$out" | grep -q '<svg'; then
      echo "NG   $path not an SVG"
      fail=1
      return
    fi
    echo "OK   $path ($ctype, $(wc -c <"$out" | tr -d ' ') bytes)"
  fi
}

for kind in inline inline-custom rect icon; do
  check "/v2/$kind.svg" image/svg+xml
  check "/v2/$kind.png" image/png
done
check "/v2/icon.png?seed=docker&width=256&circle=1" image/png
check "/v2/rect.png?width=300&colorTheme=dark" image/png

if [ $fail -ne 0 ]; then
  echo "==> Container logs"
  docker logs "$NAME"
  exit 1
fi
echo "==> Docker smoke test passed"
