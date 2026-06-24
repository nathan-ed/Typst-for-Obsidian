# Mobile support (fork additions)

This fork adds **Obsidian mobile support** to Typst for Obsidian:

- **Edit `.typ` files on mobile** with a lightweight plain-text editor.
- **Export to PDF on mobile**, including documents that use Typst `@preview`
  packages — even packages that ship native WASM plugins (e.g. `cetz`).

Compilation on mobile is **export-only**: there is no live preview or
compile-on-save (those stay desktop-only), which keeps editing fast and the app
stable. Everything below explains the problems that had to be solved and how.

---

## The core problem: Obsidian Sync's 5 MB per-file limit

The plugin's `main.js` was ~10 MB, and **91% of it was `monaco-editor`** (the
desktop source editor). Obsidian Sync refuses to sync any single file larger
than **5 MB**, so `main.js` never reached the phone — the plugin showed a
generic **"Failed to load plugin"** and no source change had any effect, because
the device kept running an old/partial bundle.

Every other mobile issue was downstream of this. The fix was to get `main.js`
(and every artifact that must reach mobile) **under 5 MB**.

---

## 1. Split `monaco-editor` out of `main.js`

monaco is desktop-only but was bundled into the single `main.js`. It's now built
as a **separate, desktop-only file** and loaded at runtime, dropping `main.js`
from ~10 MB to **~0.83 MB** (well under the Sync limit).

- `src/monacoBundle.ts` → built (minified, IIFE) into **`monaco.js`** (~4 MB);
  it assigns the monaco namespace to `globalThis.__TYPST_MONACO__`.
- `src/monacoExternal.cjs` is a tiny shim (`module.exports =
  globalThis.__TYPST_MONACO__`). An esbuild `onResolve` plugin
  (`monacoShimPlugin`) redirects the bare `monaco-editor` import in the main
  build to this shim, so monaco is **not** bundled into `main.js`. Subpath
  imports (the editor CSS) still resolve to the real package and land in
  `styles.css`.
- `TypstForObsidian.loadMonaco()` reads `monaco.js` from the plugin folder and
  evaluates it (global scope) on **desktop only**, before importing
  `./typstEditor` / `./grammar/typstLanguage`.
- `deploy-local.sh` / `build.js` copy `monaco.js` alongside the usual files.

`monaco.js` is desktop-only and is never loaded on mobile (mobile uses the plain
editor), so it doesn't matter that it's large.

## 2. Resilient load + mobile is edit-only

- `onload()` is wrapped so it **never rejects**: the editor view is registered
  first, and any later failure surfaces as an on-screen `Notice` instead of a
  silent "Failed to load plugin" (crucial when there's no mobile console).
- On mobile the editor uses the existing `PlainTypstEditor` (no monaco); the
  view is forced to **source mode** with no live preview / reading mode.
- `js-untar` is now **lazy-loaded**. Imported eagerly it runs
  `URL.createObjectURL(new Blob(...))` at module scope, which throws on the
  mobile webview and broke plugin load.

## 3. Mobile PDF export pipeline

Compilation needs the ~40 MB Typst compiler WASM. The original worker already
had a mobile/Capacitor code path (synchronous file reads via
`http://localhost/_capacitor_file_...`, no `SharedArrayBuffer`), so the compiler
itself was designed to run on mobile — it just couldn't get there. Making export
work required:

### a. Hosting + chunked download of the compiler WASM

The 40 MB WASM can't sync (5 MB limit), so on mobile it is **downloaded once**
from a hosted URL (`TYPST_WASM_URL`) and cached in the vault.

A single `requestUrl` of the whole file **OOM-crashed the app** on mobile
(binary comes back base64-encoded, ballooning memory). It's now downloaded in
**4 MB HTTP `Range` chunks** with a progress notice, capping transient memory.

### b. Zero-copy hand-off to the worker

Instead of `readBinary` → `Blob` → `createObjectURL` → `fetch` (several 40 MB
copies), the WASM `ArrayBuffer` is **transferred** to the worker via
`postMessage(..., [buffer])`, minimizing peak memory during instantiation.

### c. Wait for the worker before compiling

Mobile initializes the compiler lazily on the first export. The first compile
raced the (async) WASM instantiation and failed with "Compiler not initialized".
`compileToPdf` now awaits a `workerReady` promise that resolves on the worker's
`ready` message.

### d. Packages: compile-and-retry download

Desktop downloads `@preview` packages on demand mid-compile (via the
`SharedArrayBuffer` callback to the main thread). The mobile path is synchronous
and can't do that. Instead, when a mobile compile fails with
`package not found (searched for @ns/name:version)`, the plugin parses that spec,
downloads the package (`requestUrl` → `fflate` → `js-untar`), refreshes the
worker's package list, and **recompiles**. Typst reports one missing package per
attempt, so this resolves packages no matter where the import lives — the
document, a template, another imported `.typ`, or a package-to-package
dependency.

### e. Binary package files (WASM plugins, e.g. cetz)

Packages like `cetz` load a native plugin via `plugin("cetz_core.wasm")`. Typst
requests such files with a `:binary` suffix. The mobile worker now strips that
suffix and reads the **raw bytes** over synchronous XHR using the
`text/plain; charset=x-user-defined` trick (a sync XHR cannot use
`responseType = "arraybuffer"`), rebuilding a `Uint8Array`. `packageManager` also
creates the full directory chain before writing extracted files so nested binary
assets reliably land on disk.

---

## Setup for this fork (hosting the compiler WASM)

Because mobile downloads the compiler WASM from a URL, a fork needs to host it:

1. Create a **GitHub Release** tagged `wasm` on your fork.
2. Upload `release/obsidian_typst_bg.wasm` as a release asset.
3. Point `TYPST_WASM_URL` in `src/util/constants.ts` at it:
   `https://github.com/<owner>/Typst-for-Obsidian/releases/download/wasm/obsidian_typst_bg.wasm`

Desktop is unaffected by this — it uses the WASM deployed locally and never
downloads.

### Deploying to mobile

`./deploy-local.sh` builds and copies `main.js`, `monaco.js`, `styles.css`,
`manifest.json` (+ the desktop WASM) into your vault. Obsidian Sync carries the
small files to mobile (all < 5 MB). On the first export on mobile, the compiler
WASM downloads once (~40 MB) and is cached; packages download on first use.

---

## Limitations & notes

- **Mobile is export-only** — no live preview or compile-on-save by design.
- **First export downloads ~40 MB** (one-time, cached) plus any packages used.
- **Memory**: compiling a 40 MB WASM is heavy for a mobile webview. This was
  tuned for a sub-6 GB Android device; iOS WKWebView has tighter limits and is
  more likely to hit a wall.
- **System fonts** remain desktop-only; mobile relies on the fonts embedded in
  the compiler WASM.
- The binary-file XHR read holds the file as a string transiently (~2× its
  size); fine for small plugin WASMs like `cetz_core`.

---

## Changed files

| File | Change |
|------|--------|
| `src/main.ts` | Resilient `onload`; `loadMonaco`; mobile export-only `compileToPdf`; `workerReady` gating; chunked WASM download; package compile-retry |
| `src/compiler.worker.ts` | Binary file reads on mobile (`:binary` + `x-user-defined`) |
| `src/packageManager.ts` | Lazy `js-untar`; create nested dirs when extracting packages |
| `src/typstView.ts` | Force source mode + export-only action bar on mobile |
| `src/ui/viewActionBar.ts` | Hide reading-toggle / live-preview buttons on mobile |
| `src/util/constants.ts` | `TYPST_WASM_URL` |
| `src/monacoBundle.ts`, `src/monacoExternal.cjs` | monaco split entry + shim |
| `esbuild.config.mjs` | `monaco.js` build, monaco-shim resolver, warning fixes |
| `build.js`, `deploy-local.sh` | Ship `monaco.js` |
