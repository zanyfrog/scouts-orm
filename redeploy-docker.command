#!/bin/zsh
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cd "$(dirname "$0")"

project_name="$(basename "$PWD")"

echo "Redeploying ${project_name}"
echo "Working directory: $PWD"
echo

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker was not found on PATH."
  echo "Open Docker Desktop, then try again."
  read -r "?Press Return to close..."
  exit 1
fi

echo "Stopping ${project_name} Docker Compose stack..."
docker compose down

echo
echo "Building ${project_name} Docker Compose stack..."
docker compose build

echo
echo "Starting ${project_name} Docker Compose stack..."
docker compose up -d

echo
echo "Current container status:"
docker compose ps

echo
echo "Done."
read -r "?Press Return to close..."
