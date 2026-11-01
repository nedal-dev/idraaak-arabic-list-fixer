/* Idraaak Arabic List Fixer | MIT | https://idraaak.com/ */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ArabicListFixer
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/core.ts
var MAX_NOTE_LENGTH = 1e6;
var MAX_FIXES = 300;
function linesOf(text) {
  var _a, _b, _c, _d;
  const chunks = (_a = text.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g)) != null ? _a : [];
  let start = 0;
  const lines = [];
  for (const chunk of chunks) {
    if (chunk === "") break;
    const line = chunk.replace(/(?:\r\n|\r|\n)$/, "");
    const parts = /^((?: {0,3}>[ \t]?)*)( {0,3})(.*)$/.exec(line);
    const prefix = ((_b = parts == null ? void 0 : parts[1]) != null ? _b : "") + ((_c = parts == null ? void 0 : parts[2]) != null ? _c : "");
    lines.push({ text: line, start, body: (_d = parts == null ? void 0 : parts[3]) != null ? _d : line, prefix });
    start += chunk.length;
  }
  return lines;
}
function latinDigits(text) {
  return text.replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 1776 ? code - 1776 : code - 1632);
  });
}
function planFixes(text, includeIsolated = false, scope) {
  if (text.length > MAX_NOTE_LENGTH) throw new Error("note-too-large");
  const region = scope != null ? scope : { from: 0, to: text.length };
  if (!Number.isInteger(region.from) || !Number.isInteger(region.to) || region.from < 0 || region.to < region.from || region.to > text.length) {
    throw new Error("invalid-scope");
  }
  const lines = linesOf(text);
  const candidates = [];
  let frontmatter = false;
  let fence;
  let math = false;
  let comment = false;
  let htmlTag;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const body = line.body;
    const trimmed = body.trimStart();
    if (index === 0 && /^\uFEFF?---\s*$/.test(line.text)) {
      frontmatter = true;
      continue;
    }
    if (frontmatter) {
      if (/^(?:---|\.\.\.)\s*$/.test(line.text)) frontmatter = false;
      continue;
    }
    if (fence) {
      const end = /^(`+|~+)\s*$/.exec(trimmed);
      if (end && end[1][0] === fence.char && end[1].length >= fence.length) fence = void 0;
      continue;
    }
    if (comment) {
      if (body.includes("-->")) comment = false;
      continue;
    }
    if (htmlTag) {
      if (new RegExp(`</${htmlTag}\\s*>`, "i").test(body)) htmlTag = void 0;
      continue;
    }
    if (math) {
      if (body.includes("$$")) math = false;
      continue;
    }
    const fenceBody = trimmed.replace(/^(?:[*+-]|[0-9\u0660-\u0669\u06f0-\u06f9]{1,9}[.)])[ \t]+/, "");
    const opening = /^(`{3,}|~{3,})(.*)$/.exec(fenceBody);
    if (opening) {
      fence = { char: opening[1][0], length: opening[1].length };
      continue;
    }
    if (body.includes("<!--")) {
      comment = body.lastIndexOf("<!--") > body.lastIndexOf("-->");
      continue;
    }
    if (trimmed.startsWith("$$")) {
      math = !trimmed.slice(2).includes("$$");
      continue;
    }
    const html = /^<([a-z][a-z0-9-]*)(?:\s|>|\/)/i.exec(trimmed);
    if (html) {
      const tag = html[1].toLowerCase();
      const voidTag = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag);
      if (!voidTag && !trimmed.includes("/>") && !new RegExp(`</${tag}\\s*>`, "i").test(trimmed)) htmlTag = tag;
      continue;
    }
    if (/^(?: {4}|\t)/.test(line.text) || /^[ \t]/.test(body)) continue;
    const marker = /^([\u0660-\u0669\u06f0-\u06f9]{1,9}[.)]|\([\u0660-\u0669\u06f0-\u06f9]{1,9}\))([ \t]+)(\S.*)$/.exec(body);
    if (!marker) continue;
    const original = marker[1];
    const number = Number(latinDigits(original.replace(/[().]/g, "")));
    const replacement = `${number}.`;
    const from = line.start + line.prefix.length;
    candidates.push({
      from,
      to: from + original.length,
      replacement,
      number,
      line: index + 1,
      before: line.text,
      after: line.prefix + replacement + body.slice(original.length),
      prefix: line.prefix,
      grouped: false
    });
  }
  for (let i = 1; i < candidates.length; i++) {
    const previous = candidates[i - 1];
    const current = candidates[i];
    const between = lines.slice(previous.line, current.line - 1);
    const consecutive = current.number === previous.number + 1 || current.number === 1 && previous.number === 1;
    if (previous.prefix === current.prefix && consecutive && between.every((line) => line.body.trim() === "")) {
      previous.grouped = current.grouped = true;
    }
  }
  const inScope = candidates.filter((item) => item.from >= region.from && item.to <= region.to);
  const isolated = inScope.filter((item) => !item.grouped).length;
  const fixes = inScope.filter((item) => item.grouped || includeIsolated).map(({ from, to, replacement, line, before, after }) => ({ from, to, replacement, line, before, after }));
  if (fixes.length > MAX_FIXES) throw new Error("too-many-fixes");
  return { fixes, isolated };
}

// src/main.ts
var en = {
  selection: "Preview Arabic list fixes in selection",
  note: "Preview Arabic list fixes in current note",
  title: "Preview Arabic list fixes",
  intro: "Only the numbered markers shown below will change. Item text, links and code are kept as written.",
  isolated: "Include isolated or nonconsecutive numbered lines",
  isolatedHelp: "Off by default. Enable only after checking that these lines are list items, not dates or prose.",
  before: "Before",
  after: "After",
  line: "Line",
  changes: "Markers to change",
  skipped: "Isolated lines skipped",
  cancel: "Cancel",
  apply: "Apply fixes",
  empty: "No matching list markers in this scope.",
  select: "Select text in one editor range first.",
  stale: "The note changed while the preview was open. Close it and run the command again.",
  done: "Arabic list markers updated. Use Undo to revert.",
  large: `This note is too large to preview (limit: ${MAX_NOTE_LENGTH.toLocaleString("en-US")} characters).`,
  many: `More than ${MAX_FIXES} markers match. Select a smaller section and try again.`,
  error: "Unable to preview this editor range. Close the preview and try again."
};
var ar = {
  selection: "\u0645\u0639\u0627\u064A\u0646\u0629 \u0625\u0635\u0644\u0627\u062D \u0627\u0644\u0642\u0648\u0627\u0626\u0645 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0641\u064A \u0627\u0644\u0646\u0635 \u0627\u0644\u0645\u062D\u062F\u062F",
  note: "\u0645\u0639\u0627\u064A\u0646\u0629 \u0625\u0635\u0644\u0627\u062D \u0627\u0644\u0642\u0648\u0627\u0626\u0645 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0641\u064A \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629",
  title: "\u0645\u0639\u0627\u064A\u0646\u0629 \u0625\u0635\u0644\u0627\u062D \u0627\u0644\u0642\u0648\u0627\u0626\u0645 \u0627\u0644\u0639\u0631\u0628\u064A\u0629",
  intro: "\u0633\u062A\u062A\u063A\u064A\u0631 \u0639\u0644\u0627\u0645\u0627\u062A \u0627\u0644\u062A\u0631\u0642\u064A\u0645 \u0627\u0644\u0645\u0639\u0631\u0648\u0636\u0629 \u0641\u0642\u0637. \u064A\u0628\u0642\u0649 \u0646\u0635 \u0627\u0644\u0628\u0646\u0648\u062F \u0648\u0627\u0644\u0631\u0648\u0627\u0628\u0637 \u0648\u0627\u0644\u0623\u0643\u0648\u0627\u062F \u0643\u0645\u0627 \u0647\u0648.",
  isolated: "\u062A\u0636\u0645\u064A\u0646 \u0627\u0644\u0623\u0633\u0637\u0631 \u0627\u0644\u0645\u0646\u0641\u0631\u062F\u0629 \u0623\u0648 \u063A\u064A\u0631 \u0627\u0644\u0645\u062A\u062A\u0627\u0628\u0639\u0629 \u0641\u064A \u0627\u0644\u062A\u0631\u0642\u064A\u0645",
  isolatedHelp: "\u0645\u0639\u0637\u0644 \u0627\u0641\u062A\u0631\u0627\u0636\u064A\u064B\u0627. \u0641\u0639\u0651\u0644\u0647 \u0628\u0639\u062F \u0627\u0644\u062A\u0623\u0643\u062F \u0623\u0646 \u0627\u0644\u0623\u0633\u0637\u0631 \u0628\u0646\u0648\u062F \u0642\u0627\u0626\u0645\u0629 \u0648\u0644\u064A\u0633\u062A \u062A\u0648\u0627\u0631\u064A\u062E \u0623\u0648 \u0641\u0642\u0631\u0627\u062A \u0639\u0627\u062F\u064A\u0629.",
  before: "\u0642\u0628\u0644",
  after: "\u0628\u0639\u062F",
  line: "\u0627\u0644\u0633\u0637\u0631",
  changes: "\u0639\u0644\u0627\u0645\u0627\u062A \u0627\u0644\u062A\u0631\u0642\u064A\u0645 \u0627\u0644\u062A\u064A \u0633\u062A\u062A\u063A\u064A\u0631",
  skipped: "\u0627\u0644\u0623\u0633\u0637\u0631 \u0627\u0644\u0645\u0646\u0641\u0631\u062F\u0629 \u0627\u0644\u0645\u0633\u062A\u062B\u0646\u0627\u0629",
  cancel: "\u0625\u0644\u063A\u0627\u0621",
  apply: "\u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u0625\u0635\u0644\u0627\u062D\u0627\u062A",
  empty: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0639\u0644\u0627\u0645\u0627\u062A \u0642\u0648\u0627\u0626\u0645 \u0645\u0637\u0627\u0628\u0642\u0629 \u0636\u0645\u0646 \u0647\u0630\u0627 \u0627\u0644\u0646\u0637\u0627\u0642.",
  select: "\u062D\u062F\u062F \u0627\u0644\u0646\u0635 \u0641\u064A \u0646\u0637\u0627\u0642 \u0648\u0627\u062D\u062F \u062F\u0627\u062E\u0644 \u0627\u0644\u0645\u062D\u0631\u0631 \u0623\u0648\u0644\u064B\u0627.",
  stale: "\u062A\u063A\u064A\u0631\u062A \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0629 \u0623\u062B\u0646\u0627\u0621 \u0641\u062A\u062D \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629. \u0623\u063A\u0644\u0642\u0647\u0627 \u062B\u0645 \u0634\u063A\u0651\u0644 \u0627\u0644\u0623\u0645\u0631 \u0645\u062C\u062F\u062F\u064B\u0627.",
  done: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0639\u0644\u0627\u0645\u0627\u062A \u0627\u0644\u0642\u0648\u0627\u0626\u0645 \u0627\u0644\u0639\u0631\u0628\u064A\u0629. \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0639\u0646 \u0627\u0644\u062A\u063A\u064A\u064A\u0631 \u0628\u0623\u0645\u0631 \u0627\u0644\u062A\u0631\u0627\u062C\u0639.",
  large: "\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0629 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0644\u0644\u0645\u0639\u0627\u064A\u0646\u0629 \u0648\u0647\u0648 \u0645\u0644\u064A\u0648\u0646 \u0645\u062D\u0631\u0641.",
  many: `\u0639\u062F\u062F \u0627\u0644\u0639\u0644\u0627\u0645\u0627\u062A \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629 \u064A\u062A\u062C\u0627\u0648\u0632 ${MAX_FIXES}. \u062D\u062F\u062F \u0642\u0633\u0645\u064B\u0627 \u0623\u0635\u063A\u0631 \u062B\u0645 \u062D\u0627\u0648\u0644 \u0645\u062C\u062F\u062F\u064B\u0627.`,
  error: "\u062A\u0639\u0630\u0631\u062A \u0645\u0639\u0627\u064A\u0646\u0629 \u0647\u0630\u0627 \u0627\u0644\u0646\u0637\u0627\u0642. \u0623\u063A\u0644\u0642 \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629 \u062B\u0645 \u062D\u0627\u0648\u0644 \u0645\u062C\u062F\u062F\u064B\u0627."
};
var FixPreview = class extends import_obsidian.Modal {
  constructor(app, editor, snapshot, editScope, labels, arabic, closed) {
    super(app);
    this.editor = editor;
    this.snapshot = snapshot;
    this.editScope = editScope;
    this.labels = labels;
    this.arabic = arabic;
    this.closed = closed;
    this.includeIsolated = false;
    this.plan = { fixes: [], isolated: 0 };
  }
  onOpen() {
    this.modalEl.addClass("idraaak-list-fixer");
    this.contentEl.setAttribute("dir", this.arabic ? "rtl" : "ltr");
    this.render();
  }
  render() {
    const c = this.contentEl;
    c.empty();
    c.createEl("h2", { text: this.labels.title });
    c.createEl("p", { text: this.labels.intro });
    const option = c.createEl("label", { cls: "idraaak-list-option" });
    const checkbox = option.createEl("input", { type: "checkbox" });
    checkbox.checked = this.includeIsolated;
    option.createSpan({ text: this.labels.isolated });
    checkbox.addEventListener("change", () => {
      var _a;
      this.includeIsolated = checkbox.checked;
      this.render();
      (_a = this.contentEl.querySelector("input")) == null ? void 0 : _a.focus();
    });
    c.createEl("p", { text: this.labels.isolatedHelp, cls: "setting-item-description" });
    try {
      this.plan = planFixes(this.snapshot, this.includeIsolated, this.editScope);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      c.createEl("p", { text: message === "note-too-large" ? this.labels.large : message === "too-many-fixes" ? this.labels.many : this.labels.error });
      new import_obsidian.ButtonComponent(c.createDiv({ cls: "idraaak-list-actions" })).setButtonText(this.labels.cancel).onClick(() => this.close());
      return;
    }
    c.createEl("p", { text: `${this.labels.changes}: ${this.plan.fixes.length} \xB7 ${this.labels.skipped}: ${this.includeIsolated ? 0 : this.plan.isolated}`, cls: "idraaak-list-count" });
    const preview = c.createDiv({ cls: "idraaak-list-preview" });
    if (this.plan.fixes.length === 0) preview.createEl("p", { text: this.labels.empty });
    for (const fix of this.plan.fixes) {
      const row = preview.createDiv({ cls: "idraaak-list-change" });
      row.createEl("h3", { text: `${this.labels.line} ${fix.line}` });
      row.createDiv({ text: this.labels.before, cls: "idraaak-list-label" });
      row.createEl("pre", { text: fix.before }).setAttribute("dir", "auto");
      row.createDiv({ text: this.labels.after, cls: "idraaak-list-label" });
      row.createEl("pre", { text: fix.after }).setAttribute("dir", "auto");
    }
    const actions = c.createDiv({ cls: "idraaak-list-actions" });
    new import_obsidian.ButtonComponent(actions).setButtonText(this.labels.cancel).onClick(() => this.close());
    new import_obsidian.ButtonComponent(actions).setButtonText(this.labels.apply).setCta().setDisabled(this.plan.fixes.length === 0).onClick(() => this.apply());
  }
  apply() {
    if (this.editor.getValue() !== this.snapshot) {
      new import_obsidian.Notice(this.labels.stale);
      return;
    }
    if (this.plan.fixes.length === 0) return;
    this.editor.transaction({ changes: this.plan.fixes.map((fix) => ({ from: this.editor.offsetToPos(fix.from), to: this.editor.offsetToPos(fix.to), text: fix.replacement })) });
    this.close();
    new import_obsidian.Notice(this.labels.done);
  }
  onClose() {
    this.contentEl.empty();
    this.closed();
  }
};
var ArabicListFixer = class extends import_obsidian.Plugin {
  showPreview(editor, snapshot, scope, labels, arabic) {
    var _a;
    (_a = this.preview) == null ? void 0 : _a.close();
    const preview = new FixPreview(this.app, editor, snapshot, scope, labels, arabic, () => {
      if (this.preview === preview) this.preview = void 0;
    });
    this.preview = preview;
    preview.open();
  }
  onload() {
    const arabic = (0, import_obsidian.getLanguage)().startsWith("ar");
    const labels = arabic ? ar : en;
    this.addCommand({ id: "preview-selection", name: labels.selection, editorCallback: (editor) => {
      if (editor.listSelections().length !== 1 || !editor.somethingSelected()) {
        new import_obsidian.Notice(labels.select);
        return;
      }
      const snapshot = editor.getValue();
      const from = editor.posToOffset(editor.getCursor("from"));
      const to = editor.posToOffset(editor.getCursor("to"));
      this.showPreview(editor, snapshot, { from, to }, labels, arabic);
    } });
    this.addCommand({ id: "preview-note", name: labels.note, editorCallback: (editor) => {
      const snapshot = editor.getValue();
      this.showPreview(editor, snapshot, { from: 0, to: snapshot.length }, labels, arabic);
    } });
  }
  onunload() {
    var _a;
    (_a = this.preview) == null ? void 0 : _a.close();
  }
};
