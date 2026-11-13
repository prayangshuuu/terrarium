#!/usr/bin/env bash
# scripts/uninstall-global.sh
# Uninstalls the global TERRARIUM symlink from ~/.local/bin/terrarium

set -euo pipefail

TARGET_BIN="${HOME}/.local/bin/terrarium"

echo "TERRARIUM GLOBAL UNINSTALLER"
echo "================================================================================"

if [ -L "${TARGET_BIN}" ] || [ -f "${TARGET_BIN}" ]; then
  rm -f "${TARGET_BIN}"
  echo "[OK] Removed ${TARGET_BIN}"
else
  echo "[INFO] ${TARGET_BIN} does not exist. Nothing to remove."
fi

echo "Uninstallation complete."
echo "================================================================================"
