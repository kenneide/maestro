#!/bin/bash
# Installs Maestro Cue for the current user. Run from the unzipped package folder.
# DEST_ROOT overrides the install root (default: your home folder) for testing.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
dest_root="${DEST_ROOT:-$HOME}"
components="$dest_root/Library/Audio/Plug-Ins/Components"
apps="$dest_root/Applications"

echo "Installing Maestro Cue..."
mkdir -p "$components" "$apps"
rm -rf "$components/Maestro Cue.component" "$apps/Maestro Cue.app"
ditto "$here/Maestro Cue.component" "$components/Maestro Cue.component"
ditto "$here/Maestro Cue.app" "$apps/Maestro Cue.app"

# The build is ad-hoc signed (not notarized): clear the download quarantine so
# macOS and djay will load it.
xattr -dr com.apple.quarantine "$components/Maestro Cue.component" "$apps/Maestro Cue.app" 2>/dev/null || true

echo "  AU plugin -> $components/Maestro Cue.component"
echo "  App       -> $apps/Maestro Cue.app"

if [[ -n "${DEST_ROOT:-}" ]]; then
    echo "Test install (DEST_ROOT set): skipping plugin registration."
    exit 0
fi

# Refresh the Audio Unit cache, and launch the app once so macOS registers the AUv3 extension.
killall -9 AudioComponentRegistrar 2>/dev/null || true
open -g "$apps/Maestro Cue.app"
sleep 3
osascript -e 'quit app "Maestro Cue"' 2>/dev/null || true

if auval -v aufx Mcue Knde > /dev/null 2>&1; then
    echo "Audio Unit validation: PASS"
else
    echo "Audio Unit validation: FAILED. Run 'auval -v aufx Mcue Knde' in Terminal for details."
fi

cat <<'EOF'

Next steps:
  1. Quit and reopen djay Pro.
  2. Load "Kenneide: Maestro Cue" in a djay audio FX / plugin slot.
  3. In the plugin's SEND TO field, enter the IP address and port of the computer running Maestro
     (default 127.0.0.1:9000 = this Mac), then press Apply.
EOF
