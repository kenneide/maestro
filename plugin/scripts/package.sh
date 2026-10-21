#!/bin/bash
# Builds a universal (arm64 + x86_64), ad-hoc signed Maestro Cue package and zips it
# for installing on another Mac. Output: plugin/dist/MaestroCue-<version>-macOS.zip
# --reveal selects the zip in Finder when done.
set -euo pipefail

plugin_dir="$(cd "$(dirname "$0")/.." && pwd)"
build_dir="$plugin_dir/build-dist"
version="$(sed -n 's/^project(MaestroCue VERSION \([0-9.]*\)).*/\1/p' "$plugin_dir/CMakeLists.txt")"
name="MaestroCue-$version"
stage="$plugin_dir/dist/$name"
zip="$plugin_dir/dist/$name-macOS.zip"
artefacts="$build_dir/MaestroCue_artefacts/Release"

echo "==> Building Maestro Cue $version (universal, Release)"
cmake -S "$plugin_dir" -B "$build_dir" -G Xcode -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64" > /dev/null
cmake --build "$build_dir" --config Release -- -quiet

echo "==> Staging $stage"
rm -rf "$stage" "$zip"
mkdir -p "$stage"
ditto "$artefacts/AU/Maestro Cue.component" "$stage/Maestro Cue.component"
ditto "$artefacts/Standalone/Maestro Cue.app" "$stage/Maestro Cue.app"
install -m 755 "$plugin_dir/scripts/install.command" "$stage/Install Maestro Cue.command"
install -m 755 "$plugin_dir/scripts/uninstall.command" "$stage/Uninstall Maestro Cue.command"
install -m 644 "$plugin_dir/scripts/READ ME.txt" "$stage/READ ME.txt"

echo "==> Verifying"
for bundle in "$stage/Maestro Cue.component" "$stage/Maestro Cue.app"; do
    codesign --verify --deep --strict "$bundle"
done
for binary in "$stage/Maestro Cue.component/Contents/MacOS/Maestro Cue" \
              "$stage/Maestro Cue.app/Contents/MacOS/Maestro Cue" \
              "$stage/Maestro Cue.app/Contents/PlugIns/Maestro Cue.appex/Contents/MacOS/Maestro Cue"; do
    archs="$(lipo -archs "$binary")"
    [[ "$archs" == *arm64* && "$archs" == *x86_64* ]] || { echo "Not universal: $binary ($archs)" >&2; exit 1; }
    echo "    $(basename "$(dirname "$(dirname "$(dirname "$binary")")")"): $archs"
done

ditto -c -k --keepParent "$stage" "$zip"
echo "==> Done: $zip"
[[ "${1:-}" == "--reveal" ]] && open -R "$zip"
exit 0
