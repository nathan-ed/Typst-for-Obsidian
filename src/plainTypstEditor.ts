import TypstForObsidian from "./main";

export interface PlainEditorState {
  lineNumber: number;
  column: number;
  scrollTop: number;
}

export class PlainTypstEditor {
  private textarea: HTMLTextAreaElement | null = null;
  private content = "";

  constructor(
    private container: HTMLElement,
    private plugin: TypstForObsidian,
    private onContentChange?: (content: string) => void,
  ) {}

  async initialize(initialContent: string = ""): Promise<void> {
    this.content = initialContent;
    this.container.empty();
    this.container.addClass("typst-plain-editor-container");

    const textarea = this.container.createEl("textarea", {
      cls: "typst-plain-editor",
    });
    textarea.value = initialContent;
    textarea.spellcheck = false;
    textarea.wrap = "soft";
    textarea.style.fontSize = `${this.plugin.settings.editorFontSize}px`;

    textarea.addEventListener("input", () => {
      this.content = textarea.value;
      this.onContentChange?.(this.content);
    });

    this.textarea = textarea;
    requestAnimationFrame(() => textarea.focus());
  }

  destroy(): void {
    this.textarea = null;
    this.container.empty();
  }

  getContent(): string {
    return this.textarea?.value ?? this.content;
  }

  setContent(content: string): void {
    this.content = content;
    if (this.textarea) this.textarea.value = content;
  }

  getEditorState(): PlainEditorState | null {
    if (!this.textarea) return null;
    const offset = this.textarea.selectionStart;
    const before = this.textarea.value.slice(0, offset);
    const lines = before.split("\n");
    return {
      lineNumber: lines.length,
      column: lines[lines.length - 1].length + 1,
      scrollTop: this.textarea.scrollTop,
    };
  }

  restoreEditorState(state: PlainEditorState): void {
    if (!this.textarea) return;
    const lines = this.textarea.value.split("\n");
    let offset = 0;
    for (let i = 0; i < Math.max(0, state.lineNumber - 1); i++) {
      offset += (lines[i]?.length ?? 0) + 1;
    }
    offset += Math.max(0, state.column - 1);
    offset = Math.min(offset, this.textarea.value.length);
    this.textarea.setSelectionRange(offset, offset);
    this.textarea.scrollTop = state.scrollTop;
    this.textarea.focus();
  }

  goToLine(line: number, column: number = 1): void {
    this.restoreEditorState({ lineNumber: line, column, scrollTop: 0 });
  }

  focus(): void {
    this.textarea?.focus();
  }

  onResize(): void {}

  async updateTheme(): Promise<void> {}

  updateFontSize(size: number): void {
    if (this.textarea) this.textarea.style.fontSize = `${size}px`;
  }

  insertSnippet(snippetText: string): void {
    this.insertText(snippetText.replace(/\$\{(\d+):([^}]+)\}/g, "$2").replace(/\$\d+/g, ""));
  }

  async paste(): Promise<void> {
    try {
      this.insertText(await navigator.clipboard.readText());
    } catch {
      this.textarea?.focus();
    }
  }

  undo(): boolean {
    this.textarea?.focus();
    document.execCommand("undo");
    return true;
  }

  redo(): boolean {
    this.textarea?.focus();
    document.execCommand("redo");
    return true;
  }

  triggerAction(_actionId: string): boolean {
    return false;
  }

  toggleFormatting(prefix: string, suffix: string): void {
    if (!this.textarea) return;
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const selected = this.textarea.value.slice(start, end);
    this.replaceRange(start, end, `${prefix}${selected}${suffix}`);
    this.textarea.setSelectionRange(start + prefix.length, end + prefix.length);
  }

  increaseHeadingLevel(): void {
    this.insertText("=");
  }

  decreaseHeadingLevel(): void {}

  private insertText(text: string): void {
    if (!this.textarea) return;
    this.replaceRange(this.textarea.selectionStart, this.textarea.selectionEnd, text);
  }

  private replaceRange(start: number, end: number, text: string): void {
    if (!this.textarea) return;
    const value = this.textarea.value;
    this.textarea.value = value.slice(0, start) + text + value.slice(end);
    const cursor = start + text.length;
    this.textarea.setSelectionRange(cursor, cursor);
    this.textarea.dispatchEvent(new Event("input", { bubbles: true }));
    this.textarea.focus();
  }
}
