// The ~40 MB Typst compiler wasm cannot ship through Obsidian Sync (5 MB
// per-file limit), so on mobile it is downloaded once from this hosted URL and
// cached in the vault. Upload release/obsidian_typst_bg.wasm as the asset of a
// GitHub Release tagged "wasm" on this repo (update tag/owner if hosting else-
// where).
export const TYPST_WASM_URL =
  "https://github.com/nathan-ed/Typst-for-Obsidian/releases/download/wasm/obsidian_typst_bg.wasm" as const;

export const PDFIUM_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@embedpdf/pdfium@1.3.13/dist/pdfium.wasm" as const;
export const TYPST_PACKAGES_URL = "https://packages.typst.org/preview" as const;
export const ONIGURUMA_WASM_URL =
  "https://cdn.jsdelivr.net/npm/vscode-oniguruma@2.0.1/release/onig.wasm" as const;
