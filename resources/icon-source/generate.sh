#!/bin/bash
# Generate every Zotz icon from the pixel grids in zotz-bat-pixel.mjs.
# Produces: resources/build/icon.{icns,png,ico}, resources/icon.png, resources/icon-dev.png,
# resources/app-icons/*.png, resources/tray/*.png and the renderer SVGs (resources/logo*.svg).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
BUILD_DIR="$PROJECT_DIR/resources/build"
TMP_DIR=$(mktemp -d)

trap 'rm -rf "$TMP_DIR"' EXIT

ICONSET_DIR="$TMP_DIR/icon.iconset"
node "$SCRIPT_DIR/render-zotz-icons.mjs" "$ICONSET_DIR"

# iconutil ships with macOS; the iconset slots are already pixel exact, so no Icon Composer pass.
if command -v iconutil >/dev/null 2>&1; then
  iconutil -c icns "$ICONSET_DIR" -o "$BUILD_DIR/icon.icns"
  echo "  -> resources/build/icon.icns"
else
  echo "Warning: iconutil not found (macOS only); resources/build/icon.icns was not regenerated." >&2
fi

echo "Done! Icons generated in resources/"
