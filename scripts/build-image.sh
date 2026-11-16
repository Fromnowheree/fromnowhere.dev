#!/usr/bin/env bash
# Builds the production image on your own machine, for the server's processor, from a clean
# checkout. The server never builds (AGENTS.md, "Nothing is built on the server").
#
#   ./scripts/build-image.sh                 # linux/arm64: the Oracle Ampere (A1) server
#   ./scripts/build-image.sh linux/amd64     # an x86 server
#
# Then copy it over and point .env's APP_IMAGE at the printed tag:
#
#   docker save fromnowhere-web:<version> | ssh <server> docker load
#   (podman save works the same way; its default format loads into Docker.)
#
# Building for another processor than this machine's runs under emulation (qemu-user-static,
# registered with binfmt_misc): slow, but the same image. Docker needs buildx for --platform.
# Release from a version tag (docs/launch.md, "Every release"): the image is labelled with the commit.
set -euo pipefail

cd "$(dirname "$0")/.."

platform="${1:-linux/arm64}"
case "$platform" in
  linux/arm64 | linux/amd64) ;;
  *)
    echo "Unknown platform: $platform (linux/arm64 or linux/amd64)." >&2
    exit 1
    ;;
esac

if ! git diff --quiet HEAD -- || [ -n "$(git ls-files --others --exclude-standard)" ]; then
  echo "The working tree has changes that are not committed: build from a clean checkout." >&2
  exit 1
fi

engine="$(command -v docker || command -v podman || true)"
if [ -z "$engine" ]; then
  echo "Neither docker nor podman is installed." >&2
  exit 1
fi

version="$(node -p "require('./package.json').version")"
commit="$(git rev-parse HEAD)"
tag="fromnowhere-web:$version"

if [ "$(git describe --tags --exact-match 2>/dev/null || true)" != "v$version" ]; then
  echo "Note: HEAD is not tagged v$version; this image is not a release." >&2
fi

"$engine" build --platform "$platform" -t "$tag" \
  --build-arg APP_VERSION="$version" --build-arg APP_COMMIT="$commit" .

echo
echo "Built $tag for $platform from $commit."
echo "Copy it:  $(basename "$engine") save $tag | ssh <server> docker load"
echo "Then set APP_IMAGE=$tag in the server's .env and run: docker compose up -d"
