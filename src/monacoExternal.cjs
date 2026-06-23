// In the main bundle, `import ... from "monaco-editor"` resolves to this shim
// instead of bundling monaco (~9 MB) into main.js. The real monaco library is
// shipped as a separate, desktop-only file (monaco.js) that assigns the monaco
// namespace to globalThis BEFORE any editor module is loaded (see
// TypstForObsidian.loadMonaco). Keeping monaco out of main.js keeps it under
// Obsidian Sync's 5 MB per-file limit so the plugin can sync to mobile, where
// the editor (and therefore monaco) is never loaded.
module.exports = globalThis.__TYPST_MONACO__;
