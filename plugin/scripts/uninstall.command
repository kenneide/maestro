#!/bin/bash
# Removes Maestro Cue for the current user. DEST_ROOT overrides the root for testing.
set -euo pipefail

dest_root="${DEST_ROOT:-$HOME}"
osascript -e 'quit app "Maestro Cue"' 2>/dev/null || true
rm -rf "$dest_root/Library/Audio/Plug-Ins/Components/Maestro Cue.component" "$dest_root/Applications/Maestro Cue.app"
[[ -n "${DEST_ROOT:-}" ]] || killall -9 AudioComponentRegistrar 2>/dev/null || true
echo "Maestro Cue removed. Restart djay Pro."
