#!/usr/bin/env bash
set -euo pipefail

# Install Sergamon on macOS, overwriting any previous version and
# clearing the system font caches so the new glyphs show up immediately.
#
# Usage:
#   ./scripts/install-macos.sh                 # uses build/Sergamon.ttf
#   ./scripts/install-macos.sh path/to/font.ttf

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Error: this script only runs on macOS." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SRC_TTF="${1:-${REPO_ROOT}/build/Sergamon.ttf}"
DEST_DIR="${HOME}/Library/Fonts"
DEST_TTF="${DEST_DIR}/Sergamon.ttf"

if [[ ! -f "${SRC_TTF}" ]]; then
  echo "Error: font file not found at ${SRC_TTF}" >&2
  echo "Run 'npm run build' first, or pass a path as the first argument." >&2
  exit 1
fi

mkdir -p "${DEST_DIR}"

if [[ -f "${DEST_TTF}" ]]; then
  echo "Removing previous Sergamon.ttf from ${DEST_DIR}"
  rm -f "${DEST_TTF}"
fi

echo "Installing ${SRC_TTF} -> ${DEST_TTF}"
cp "${SRC_TTF}" "${DEST_TTF}"

echo "Clearing macOS font caches (requires sudo)..."
sudo atsutil databases -remove 2>/dev/null || true
sudo killall fontd 2>/dev/null || true

echo
echo "Sergamon installed successfully."
echo "You may need to restart running applications to pick up the new font."
