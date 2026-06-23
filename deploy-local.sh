#!/usr/bin/env bash
set -euo pipefail

DEST="/home/nathan/Documents/mesNotesObs/.obsidian/plugins/typst-for-obsidian"

npm run build

mkdir -p "$DEST"
cp main.js styles.css manifest.json "$DEST/"

# Desktop-only monaco bundle. It is too large for Obsidian Sync's 5 MB per-file
# limit (so it never reaches mobile, which doesn't need it), but the desktop
# vault is on this machine so we copy it directly.
if [[ -f monaco.js ]]; then
  cp monaco.js "$DEST/monaco.js"
fi

if [[ -f release/obsidian_typst_bg.wasm ]]; then
  cp release/obsidian_typst_bg.wasm "$DEST/obsidian_typst_bg.wasm"
fi

if [[ -f pkg/obsidian_typst_bg.wasm ]]; then
  mkdir -p "$DEST/pkg"
  cp pkg/obsidian_typst_bg.wasm "$DEST/pkg/obsidian_typst_bg.wasm"
  cp pkg/obsidian_typst_bg.wasm "$DEST/obsidian_typst_bg.wasm"
fi

echo "Deployed Typst for Obsidian to $DEST"
