#!/bin/zsh
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cd "$(dirname "$0")"

project_name="$(basename "$PWD")"

echo "Repository: ${project_name}"
echo "Working directory: $PWD"
echo

if [ ! -d ".git" ]; then
  echo "This script must be run from a Git repository root."
  read -r "?Press Return to close..."
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "Git was not found on PATH."
  read -r "?Press Return to close..."
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
if [ -z "$branch" ] || [ "$branch" = "HEAD" ]; then
  echo "Could not determine a normal current branch."
  read -r "?Press Return to close..."
  exit 1
fi

echo "Branch: ${branch}"
echo
echo "Current status:"
git status --short --branch
echo

commit_message="${project_name} check-in $(date '+%Y-%m-%d %H:%M:%S')"
echo "Commit message: ${commit_message}"

echo
echo "Staging all changes..."
git add -A

staged_changes="$(git diff --cached --name-only)"
if [ -z "$staged_changes" ]; then
  echo "No staged changes to commit."
else
  echo
  echo "Files staged for commit:"
  echo "$staged_changes" | sed 's/^/  /'
  echo
  git commit -m "$commit_message"
fi

echo
echo "Pushing ${branch} to origin..."
git push origin "$branch"

echo
echo "Final status:"
git status --short --branch

echo
echo "Done."
read -r "?Press Return to close..."
