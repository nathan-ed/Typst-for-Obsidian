import {
  Plugin,
  addIcon,
  Notice,
  Platform,
  requestUrl,
  TFolder,
  TFile,
  normalizePath,
} from "obsidian";
import { TypstView } from "./typstView";
import { registerCommands } from "./settings/commands";
import { TypstIcon, pluginId } from "./util/typstUtils";
import { ONIGURUMA_WASM_URL, TYPST_WASM_URL } from "./util/constants";
import { TypstSettingTab } from "./settings/settingsTab";
import { TypstSettings, DEFAULT_SETTINGS } from "./settings/settings";
import { TemplateVariableProvider } from "./templateVariableProvider";
import { BacklinkParser, BACKLINK_URI_PREFIX } from "./backlinkParser";
import { PackageManager } from "./packageManager";
import { FontManager } from "./fontManager";
import { SnippetManager } from "./snippetManager";
// @ts-ignore
import CompilerWorker from "./compiler.worker.ts";
import { WorkerRequest } from "./types";
import { setThemeColors } from "./grammar/typstTheme";
import "monaco-editor/min/vs/editor/editor.main.css";

export default class TypstForObsidian extends Plugin {
  settings: TypstSettings;
  compilerWorker: Worker | null = null;
  templateProvider: TemplateVariableProvider;
  backlinkParser: BacklinkParser;
  packageManager: PackageManager;
  fontManager: FontManager;
  snippetManager: SnippetManager;
  textEncoder: TextEncoder;
  fs: any;
  wasmPath: string;
  pluginPath: string;
  packagePath: string;
  private isWorkerReady: boolean = false;
  private workerReady: Promise<void> | null = null;
  private workerReadyResolve: (() => void) | null = null;
  private workerReadyReject: ((err: Error) => void) | null = null;

  async onload() {
    try {
      this.textEncoder = new TextEncoder();
      this.templateProvider = new TemplateVariableProvider();
      this.backlinkParser = new BacklinkParser(this.app);
      this.snippetManager = new SnippetManager();
      await this.loadSettings();

      this.pluginPath = this.app.vault.configDir + `/plugins/${pluginId}/`;
      this.packagePath = this.pluginPath + "packages/";
      this.wasmPath = this.pluginPath + "obsidian_typst_bg.wasm";

      this.packageManager = new PackageManager(this);
      this.fontManager = new FontManager(null, this.settings.fontFamilies);

      // Register the editor view FIRST so that opening and editing .typ files
      // always works, even if compiler / syntax-highlighting setup fails later
      // (this is the supported experience on mobile, where we never compile).
      addIcon("typst-file", TypstIcon);
      this.registerView("typst-view", (leaf) => new TypstView(leaf, this));
      this.registerExtensions(["typ"], "typst-view");
      registerCommands(this);
      this.addSettingTab(new TypstSettingTab(this.app, this));

      // Monaco (the source editor + syntax highlighting) is desktop-only and
      // ships as a separate file to keep main.js under Obsidian Sync's 5 MB
      // per-file limit. Load it before any module that imports monaco.
      if (!Platform.isMobile) {
        await this.loadMonaco();
        const { setPluginInstance } = await import("./grammar/typstLanguage");
        setPluginInstance(this);
      }

      // Compiling/previewing requires the Typst WASM worker, which is not
      // supported on mobile. Initialize it in the background and never let a
      // failure here break plugin load or editing.
      if (!Platform.isMobile) {
        this.initializeCompiler().catch((error) => {
          console.error("Failed to initialize Typst compiler:", error);
          new Notice(
            "Typst compiler unavailable; source editor still works.",
            0,
          );
        });
      }
    } catch (error) {
      console.error("Typst for Obsidian failed to load:", error);
      new Notice(
        "Typst for Obsidian failed to load: " +
          ((error as Error)?.message ?? String(error)),
        0,
      );
    }

    this.registerEvent(
      this.app.workspace.on("css-change", async () => {
        await this.onThemeChange();
      }),
    );

    this.registerDomEvent(document, "click", (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") || anchor.dataset?.href || "";
      if (!href.startsWith(BACKLINK_URI_PREFIX)) return;
      e.preventDefault();
      e.stopPropagation();
      const params = new URLSearchParams(href.slice(BACKLINK_URI_PREFIX.length));
      const filePath = params.get("file") || "";
      const subpath = params.get("subpath") || "";
      const linkTarget = filePath + subpath;
      const newTab = e.ctrlKey || e.metaKey;
      this.app.workspace.openLinkText(linkTarget, "", newTab ? "tab" : false);
    }, true);

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file, source) => {
        if (
          source === "file-explorer-context-menu" ||
          source === "more-options"
        ) {
          menu.addItem((item) => {
            item
              .setTitle("New Typst file")
              .setIcon("typst-file")
              .setSection("action-primary")
              .onClick(async () => {
                const folder =
                  file instanceof TFolder
                    ? file
                    : file instanceof TFile
                      ? file.parent
                      : this.app.vault.getRoot();
                if (!folder) return;

                const baseName = "Untitled";
                let fileName = `${baseName}.typ`;
                let counter = 1;
                while (
                  this.app.vault.getAbstractFileByPath(
                    normalizePath(`${folder.path}/${fileName}`),
                  )
                ) {
                  fileName = `${baseName} ${counter}.typ`;
                  counter++;
                }

                const fullPath = normalizePath(`${folder.path}/${fileName}`);
                const newFile = await this.app.vault.create(fullPath, "");
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(newFile);
              });
          });
        }
      }),
    );
  }

  // Loads the separate, desktop-only monaco.js and exposes the monaco namespace
  // on globalThis so the main bundle's monaco-editor shim can resolve it. Must
  // run before importing ./typstEditor or ./grammar/typstLanguage.
  private async loadMonaco(): Promise<void> {
    if ((globalThis as Record<string, unknown>).__TYPST_MONACO__) return;
    const monacoPath = this.pluginPath + "monaco.js";
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(monacoPath))) {
      throw new Error(`monaco.js not found at ${monacoPath}`);
    }
    const code = await adapter.read(monacoPath);
    // Indirect eval executes in global scope so monaco.js can assign
    // globalThis.__TYPST_MONACO__.
    (0, eval)(code);
  }

  async reloadFonts(): Promise<void> {
    if (!this.compilerWorker) return;
    this.fontManager = new FontManager(
      this.compilerWorker,
      this.settings.fontFamilies,
    );
    await this.fontManager.loadFonts(this.isWorkerReady);
  }

  private async initializeCompiler(): Promise<void> {
    if (this.compilerWorker) return;

    this.compilerWorker = new CompilerWorker() as Worker;
    this.fontManager = new FontManager(
      this.compilerWorker,
      this.settings.fontFamilies,
    );

    // Resolves once the worker has finished instantiating the wasm and posted
    // "ready". compileToPdf awaits this so it never sends a compile before the
    // compiler exists (the lazy mobile init made that race surface as
    // "Compiler not initialized").
    this.workerReady = new Promise<void>((resolve, reject) => {
      this.workerReadyResolve = resolve;
      this.workerReadyReject = reject;
    });

    if (!(await this.app.vault.adapter.exists(this.wasmPath))) {
      await this.fetchWasm();
    }

    if (!Platform.isMobile) {
      await this.fetchOnigWasm();
    }

    // Transfer the wasm bytes to the worker (zero-copy) instead of building a
    // Blob + object URL + fetch. This minimizes peak memory, which matters on
    // mobile where the 40 MB wasm can otherwise OOM-crash the app.
    const wasmBytes = await this.app.vault.adapter.readBinary(this.wasmPath);
    this.compilerWorker.postMessage(
      {
        type: "startup",
        data: {
          wasm: wasmBytes,
          // @ts-ignore
          basePath: this.app.vault.adapter.basePath,
          packagePath: this.packagePath,
        },
      },
      [wasmBytes],
    );

    this.compilerWorker.addEventListener("message", (event) => {
      if (event.data?.type === "ready") {
        this.isWorkerReady = true;
        this.fontManager.loadFonts(this.isWorkerReady);
        this.workerReadyResolve?.();
      } else if (event.data?.type === "error" && !this.isWorkerReady) {
        this.workerReadyReject?.(
          new Error(event.data.error || "Typst compiler failed to initialize"),
        );
      }
    });

    if (Platform.isDesktopApp) {
      this.compilerWorker.postMessage({
        type: "canUseSharedArrayBuffer",
        data: true,
      });
      this.fs = require("fs");
    } else {
      await this.app.vault.adapter.mkdir(this.packagePath);
      const packages = await this.getPackageList();
      this.compilerWorker.postMessage({ type: "packages", data: packages });
    }
  }

  private async resetSyntaxHighlighting() {
    if (Platform.isMobile) return;
    const isDark = document.body.classList.contains("theme-dark");
    const { resetRegistry, ensureLanguageRegistered } = await import(
      "./grammar/typstLanguage"
    );
    resetRegistry();
    await ensureLanguageRegistered(isDark);
  }

  private async onThemeChange() {
    await this.resetSyntaxHighlighting();

    const updatePromises: Promise<void>[] = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof TypstView) {
        const typstView = leaf.view as TypstView;
        updatePromises.push(typstView.updateEditorTheme());
        updatePromises.push(typstView.recompileIfInReadingMode());
      }
    });
    await Promise.all(updatePromises);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    setThemeColors(this.settings.syntaxHighlightColors);

    if (!this.snippetManager.parseSnippets(this.settings.customSnippets)) {
      const error = this.snippetManager.getLastError();
      new Notice(`Snippet configuration error: ${error}`);
      console.error("Snippet parsing failed:", error);
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);

    setThemeColors(this.settings.syntaxHighlightColors);
    await this.resetSyntaxHighlighting();

    if (!this.snippetManager.parseSnippets(this.settings.customSnippets)) {
      const error = this.snippetManager.getLastError();
      new Notice(`Snippet configuration error: ${error}`);
      console.error("Snippet parsing failed:", error);
    }

    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof TypstView) {
        const typstView = leaf.view as TypstView;
        typstView.updateActionBar();
        typstView.rebuildHotkeys();
      }
    });
  }

  private async fetchWasm() {
    try {
      const adapter = this.app.vault.adapter;
      await adapter.mkdir(this.pluginPath);

      // Desktop ships the full wasm in the plugin folder; reuse it if present.
      const localSource = this.pluginPath + "pkg/obsidian_typst_bg.wasm";
      if (await adapter.exists(localSource)) {
        const wasmData = await adapter.readBinary(localSource);
        await adapter.writeBinary(this.wasmPath, wasmData);
        return;
      }

      // Mobile: the 40 MB wasm can't sync (Obsidian Sync's 5 MB limit), so
      // download it once from the hosted URL and cache it in the vault.
      // Download in Range chunks: a single requestUrl of the whole file
      // balloons memory on mobile (binary comes back base64-encoded) and
      // OOM-crashes the app, so keep each request small.
      const notice = new Notice("Downloading Typst compiler (~40 MB)…", 0);
      try {
        // Probe total size via a tiny ranged request (server sends
        // "content-range: bytes 0-0/<total>").
        const probe = await requestUrl({
          url: TYPST_WASM_URL,
          headers: { Range: "bytes=0-0" },
        });
        const contentRange =
          probe.headers["content-range"] ?? probe.headers["Content-Range"];
        const total = contentRange
          ? parseInt(contentRange.split("/")[1], 10)
          : 0;

        if (!total) {
          // Server didn't honor Range; fall back to a single download.
          const response = await requestUrl({ url: TYPST_WASM_URL });
          await adapter.writeBinary(this.wasmPath, response.arrayBuffer);
          return;
        }

        const CHUNK = 4 * 1024 * 1024;
        const combined = new Uint8Array(total);
        let offset = 0;
        while (offset < total) {
          const end = Math.min(offset + CHUNK, total) - 1;
          const chunk = await requestUrl({
            url: TYPST_WASM_URL,
            headers: { Range: `bytes=${offset}-${end}` },
          });
          combined.set(new Uint8Array(chunk.arrayBuffer), offset);
          offset = end + 1;
          notice.setMessage(
            `Downloading Typst compiler… ${Math.round((offset / total) * 100)}%`,
          );
        }
        await adapter.writeBinary(this.wasmPath, combined.buffer);
      } finally {
        notice.hide();
      }
    } catch (error) {
      console.error("Failed to fetch WASM:", error);
      throw error;
    }
  }

  private async fetchOnigWasm() {
    try {
      const onigWasmPath = this.pluginPath + "onig.wasm";
      if (await this.app.vault.adapter.exists(onigWasmPath)) {
        return;
      }

      const onigSourcePath =
        this.pluginPath + "vscode-oniguruma/release/onig.wasm";
      if (await this.app.vault.adapter.exists(onigSourcePath)) {
        const wasmData =
          await this.app.vault.adapter.readBinary(onigSourcePath);
        await this.app.vault.adapter.writeBinary(onigWasmPath, wasmData);
        return;
      }

      const response = await requestUrl({ url: ONIGURUMA_WASM_URL });
      const wasmData = response.arrayBuffer;
      await this.app.vault.adapter.writeBinary(onigWasmPath, wasmData);
    } catch (error) {
      console.error("Failed to fetch onig.wasm:", error);
      throw error;
    }
  }

  private async getPackageList(): Promise<string[]> {
    const packages: string[] = [];
    try {
      if (await this.app.vault.adapter.exists(this.packagePath)) {
        await this.collectPackageSpecs(this.packagePath, packages);
      }
    } catch (error) {
      console.error("Failed to get package list:", error);
    }
    return packages;
  }

  private async collectPackageSpecs(
    folder: string,
    packages: string[],
  ): Promise<void> {
    const entries = await this.app.vault.adapter.list(folder);

    for (const file of entries.files) {
      if (!file.endsWith("/typst.toml")) continue;
      const relative = file
        .slice(this.packagePath.length)
        .replace(/\/typst\.toml$/, "");
      if (relative.split("/").length === 3) {
        packages.push(relative);
      }
    }

    for (const child of entries.folders) {
      await this.collectPackageSpecs(child + "/", packages);
    }
  }

  // Extracts a package spec ("preview/name/version") from a Typst
  // "package not found (searched for @preview/name:version)" error.
  private parseMissingPackage(errorText: string): string | null {
    const m = errorText.match(
      /package not found \(searched for @([^:)\s]+):([^)\s]+)\)/,
    );
    return m ? `${m[1]}/${m[2]}` : null;
  }

  async compileToPdf(
    source: string,
    path: string = "/main.typ",
    compileType: "internal" | "export" = "internal",
  ): Promise<Uint8Array> {
    // On mobile, only one-shot PDF export is supported — no live preview or
    // compile-on-save. The compiler worker is initialized lazily here, on the
    // first export, so loading and editing stay fast.
    if (Platform.isMobile && compileType !== "export") {
      throw new Error("On mobile, only PDF export is supported.");
    }

    if (!this.compilerWorker) {
      await this.initializeCompiler();
    }

    if (!this.compilerWorker) {
      throw new Error("Typst compiler is not available on this device.");
    }

    // Wait for the worker to finish instantiating the wasm before compiling.
    if (this.workerReady) {
      await this.workerReady;
    }

    let finalSource = source;

    if (
      compileType === "export" &&
      this.settings.usePdfLayoutFunctions &&
      this.settings.pdfLayoutFunctions.trim()
    ) {
      finalSource = this.settings.pdfLayoutFunctions + "\n" + source;
    } else if (this.settings.useDefaultLayoutFunctions) {
      finalSource = this.settings.customLayoutFunctions + "\n" + source;
    } else {
      finalSource = "#set page(margin: (x: 0.25em, y: 0.25em))\n" + source;
    }

    if (compileType === "internal") {
      finalSource = finalSource + "\n#linebreak()\n#linebreak()";
    }

    finalSource = this.templateProvider.replaceVariables(finalSource);
    finalSource = this.backlinkParser.replaceBacklinks(finalSource, path);

    const message = {
      type: "compile",
      data: {
        format: "pdf",
        path,
        source: finalSource,
      },
    };

    const compilerWorker = this.compilerWorker;
    compilerWorker.postMessage(message);

    // Mobile can't fetch packages on demand mid-compile, so when a compile
    // fails on a missing package we download it and retry. Typst reports one
    // missing package per attempt, including those pulled in by templates,
    // other imported files, and package-to-package dependencies.
    const triedPackages = new Set<string>();

    while (true) {
      const result = await new Promise<any>((resolve, reject) => {
        const listener = (ev: MessageEvent) => {
          if (ev.data && ev.data.type === "ready") {
            return;
          }

          remove();
          resolve(ev.data);
        };

        const errorListener = (error: ErrorEvent) => {
          console.error("Worker error during PDF compile:", error);
          remove();
          reject(error);
        };

        const remove = () => {
          compilerWorker.removeEventListener("message", listener);
          compilerWorker.removeEventListener("error", errorListener);
        };

        compilerWorker.addEventListener("message", listener);
        compilerWorker.addEventListener("error", errorListener);
      });

      if (
        result instanceof Uint8Array ||
        (result &&
          result.constructor &&
          result.constructor.name === "Uint8Array")
      ) {
        return result;
      } else if (result && result.error) {
        const spec = Platform.isMobile
          ? this.parseMissingPackage(result.error)
          : null;
        if (spec && !triedPackages.has(spec)) {
          triedPackages.add(spec);
          const dlNotice = new Notice(`Downloading package @${spec}…`, 0);
          try {
            await this.packageManager.preparePackage(spec);
            const packages = await this.getPackageList();
            compilerWorker.postMessage({ type: "packages", data: packages });
            compilerWorker.postMessage(message);
            continue;
          } catch (downloadError) {
            console.error(`Failed to prepare package ${spec}:`, downloadError);
          } finally {
            dlNotice.hide();
          }
        }
        throw new Error(result.error);
      } else if (result && result.buffer && result.path) {
        await this.handleWorkerRequest(result);
        continue;
      } else {
        console.error("Unexpected PDF response format:", result);
        throw new Error("Invalid PDF response format");
      }
    }
  }

  async handleWorkerRequest({ buffer: wbuffer, path }: WorkerRequest) {
    try {
      const isBinary = path.endsWith(":binary");
      const actualPath = isBinary ? path.slice(0, -7) : path;

      if (actualPath.startsWith("@")) {
        const text = await this.packageManager.preparePackage(
          actualPath.slice(1),
        );
        if (text) {
          const encoded = this.textEncoder.encode(text);
          const numInt32s = Math.ceil((encoded.byteLength + 8) / 4);

          if (wbuffer.byteLength < numInt32s * 4) {
            // @ts-ignore
            wbuffer.buffer.grow(numInt32s * 4);
          }

          wbuffer[1] = encoded.byteLength;
          const dataView = new Uint8Array(
            wbuffer.buffer,
            8,
            encoded.byteLength,
          );
          dataView.set(encoded);

          wbuffer[0] = 0;
        }
      } else if (isBinary) {
        const binaryData = await this.packageManager.getFileBinary(actualPath);
        if (binaryData) {
          const byteLength = binaryData.byteLength;
          const numInt32s = Math.ceil((byteLength + 8) / 4);

          if (wbuffer.byteLength < numInt32s * 4) {
            // @ts-ignore
            wbuffer.buffer.grow(numInt32s * 4);
          }

          wbuffer[1] = byteLength;
          const dataView = new Uint8Array(wbuffer.buffer, 8, byteLength);
          dataView.set(new Uint8Array(binaryData));

          wbuffer[0] = 0;
        }
      } else {
        const text = await this.packageManager.getFileString(actualPath);
        if (text) {
          const encoded = this.textEncoder.encode(text);
          const numInt32s = Math.ceil((encoded.byteLength + 8) / 4);

          if (wbuffer.byteLength < numInt32s * 4) {
            // @ts-ignore
            wbuffer.buffer.grow(numInt32s * 4);
          }

          wbuffer[1] = encoded.byteLength;
          const dataView = new Uint8Array(
            wbuffer.buffer,
            8,
            encoded.byteLength,
          );
          dataView.set(encoded);

          wbuffer[0] = 0;
        }
      }
    } catch (error) {
      if (typeof error === "number") {
        wbuffer[0] = error;
      } else {
        wbuffer[0] = 1;
        console.error(error);
      }
    } finally {
      Atomics.notify(wbuffer, 0);
    }
  }
}
