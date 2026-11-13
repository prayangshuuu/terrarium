#!/usr/bin/env bash
# scripts/install-global.sh
# Installs TERRARIUM CLI globally by symlinking bin/terrarium into ~/.local/bin/terrarium

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BIN_SOURCE="${REPO_ROOT}/bin/terrarium"
TARGET_DIR="${HOME}/.local/bin"
TARGET_BIN="${TARGET_DIR}/terrarium"

echo "TERRARIUM GLOBAL INSTALLER"
echo "================================================================================"
echo "Source: ${BIN_SOURCE}"
echo "Target: ${TARGET_BIN}"

# Ensure ~/.local/bin exists
mkdir -p "${TARGET_DIR}"

# Ensure bin/terrarium is executable
chmod +x "${BIN_SOURCE}"

# Create or update symbolic link
ln -sf "${BIN_SOURCE}" "${TARGET_BIN}"

echo "[OK] Symlink established: ${TARGET_BIN} -> ${BIN_SOURCE}"

# Verify PATH
if [[ ":$PATH:" != *":${TARGET_DIR}:"* ]]; then
  echo ""
  echo "[WARN] ${TARGET_DIR} is not currently in your PATH."
  echo "Add the following line to your ~/.zshrc or ~/.bashrc:"
  echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
else
  echo "[OK] ~/.local/bin is present in PATH."
fi

echo ""
echo "Installation verified. Test with:"
echo "  terrarium --version"
echo "  terrarium doctor"
echo "================================================================================"
