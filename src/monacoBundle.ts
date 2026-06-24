// Separate, desktop-only entry point. Built into monaco.js (~9 MB) and loaded
// at runtime by TypstForObsidian.loadMonaco on desktop only. It exposes the
// monaco namespace on globalThis so the main bundle's monaco-editor shim
// (monacoExternal.cjs) can resolve it. This keeps monaco out of main.js so
// main.js stays under Obsidian Sync's 5 MB per-file limit.
import * as monaco from "monaco-editor";

(globalThis as Record<string, unknown>).__TYPST_MONACO__ = monaco;
