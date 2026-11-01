// Public-API/DOM harness. This does not claim to run the Obsidian desktop app.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { JSDOM } from "jsdom";

const bundle = fs.readFileSync(new URL("../main.js", import.meta.url), "utf8");
function setup(text, language = "en") {
  const { window } = new JSDOM("<!doctype html><body></body>");
  const document = window.document;
  const proto = window.HTMLElement.prototype;
  proto.empty = function () { this.replaceChildren(); };
  proto.addClass = function (name) { this.classList.add(name); };
  proto.createEl = function (tag, opts = {}) {
    const e = document.createElement(tag);
    if (opts.text !== undefined) e.textContent = opts.text;
    if (opts.cls) e.className = opts.cls;
    if (opts.type) e.type = opts.type;
    this.append(e);
    return e;
  };
  proto.createDiv = function (opts) { return this.createEl("div", opts); };
  proto.createSpan = function (opts) { return this.createEl("span", opts); };
  const notices = [];
  class Modal {
    constructor(app) { this.app = app; this.scope = {}; this.modalEl = document.createElement("div"); this.contentEl = this.modalEl.createDiv(); }
    open() { document.body.append(this.modalEl); this.onOpen(); }
    close() { this.onClose(); this.modalEl.remove(); }
  }
  class ButtonComponent {
    constructor(container) { this.buttonEl = container.createEl("button"); }
    setButtonText(t) { this.buttonEl.textContent = t; return this; }
    setCta() { this.buttonEl.classList.add("mod-cta"); return this; }
    setDisabled(v) { this.buttonEl.disabled = v; return this; }
    onClick(cb) { this.buttonEl.addEventListener("click", cb); return this; }
  }
  class Plugin {
    constructor(app) { this.app = app; this.commands = []; }
    addCommand(command) { this.commands.push(command); }
  }
  const api = { Modal, ButtonComponent, Plugin, Notice: class { constructor(t) { notices.push(t); } }, getLanguage: () => language };
  const module = { exports: {} };
  vm.runInNewContext(bundle, { module, exports: module.exports, require: name => { assert.equal(name, "obsidian"); return api; } });
  const plugin = new module.exports.default({});
  plugin.onload();
  const editor = {
    value: text, from: 0, to: 0, ranges: 1, transactions: [],
    getValue() { return this.value; },
    somethingSelected() { return this.to > this.from; },
    listSelections() { return Array.from({ length: this.ranges }, () => ({})); },
    getCursor(which) { return this.offsetToPos(which === "from" ? this.from : this.to); },
    offsetToPos(offset) { const a = this.value.slice(0, offset).split("\n"); return { line: a.length - 1, ch: a.at(-1).length }; },
    posToOffset(pos) { const a = this.value.split("\n"); return a.slice(0, pos.line).reduce((n, line) => n + line.length + 1, 0) + pos.ch; },
    transaction(t) {
      this.transactions.push(t);
      const changes = t.changes.map(c => ({ from: this.posToOffset(c.from), to: this.posToOffset(c.to), text: c.text }));
      for (const c of changes.reverse()) this.value = this.value.slice(0, c.from) + c.text + this.value.slice(c.to);
    }
  };
  const run = id => plugin.commands.find(c => c.id === id).editorCallback(editor);
  const button = label => [...document.querySelectorAll("button")].find(b => b.textContent === label);
  return { window, document, notices, plugin, editor, run, button };
}

test("opening preview never edits a note and shows both proposed lines", () => {
  const s = setup("١) أ\n٢) ب"); s.run("preview-note");
  assert.equal(s.editor.value, "١) أ\n٢) ب");
  assert.equal(s.editor.transactions.length, 0);
  assert.deepEqual([...s.document.querySelectorAll("pre")].map(e => e.textContent), ["١) أ", "1. أ", "٢) ب", "2. ب"]);
});
test("Cancel closes preview without editing", () => {
  const s = setup("١) أ\n٢) ب"); s.run("preview-note"); s.button("Cancel").click();
  assert.equal(s.editor.value, "١) أ\n٢) ب"); assert.equal(s.document.querySelectorAll(".idraaak-list-fixer").length, 0);
});
test("Apply uses one editor transaction and preserves bodies", () => {
  const input = "١) رابط https://example.org/١ `كود ٢`\n٢) النص ٢٠٢٦";
  const s = setup(input); s.run("preview-note"); s.button("Apply fixes").click();
  assert.equal(s.editor.value, "1. رابط https://example.org/١ `كود ٢`\n2. النص ٢٠٢٦");
  assert.equal(s.editor.transactions.length, 1);
  assert.ok(s.notices[0].includes("Undo"));
});
test("stale note guard refuses all changes", () => {
  const s = setup("١) أ\n٢) ب"); s.run("preview-note"); s.editor.value += "\nكتابة جديدة"; const changed = s.editor.value;
  s.button("Apply fixes").click();
  assert.equal(s.editor.value, changed); assert.equal(s.editor.transactions.length, 0); assert.ok(s.notices[0].includes("note changed"));
});
test("isolated items require explicitly enabling the option", () => {
  const s = setup("٥) بند منفرد"); s.run("preview-note"); assert.equal(s.button("Apply fixes").disabled, true);
  const checkbox = s.document.querySelector("input"); checkbox.checked = true; checkbox.dispatchEvent(new s.window.Event("change"));
  assert.equal(s.button("Apply fixes").disabled, false); s.button("Apply fixes").click(); assert.equal(s.editor.value, "5. بند منفرد");
});
test("Arabic interface and native RTL are selected from app language", () => {
  const s = setup("١) أ\n٢) ب", "ar"); s.run("preview-note");
  assert.equal(s.document.querySelector(".idraaak-list-fixer > div").getAttribute("dir"), "rtl");
  assert.ok(s.button("تطبيق الإصلاحات")); s.button("تطبيق الإصلاحات").click(); assert.equal(s.editor.value, "1. أ\n2. ب");
});
test("preview treats Markdown/HTML as plain text", () => {
  const s = setup('١) <img src=x onerror="alert(1)">\n٢) **نص**'); s.run("preview-note");
  assert.equal(s.document.querySelectorAll("img, script").length, 0); assert.ok(s.document.querySelector("pre").textContent.includes("<img"));
});
test("selection scope applies only the selected marker", () => {
  const s = setup("١) أ\n٢) ب\n٣) ج"); s.editor.from = s.editor.value.indexOf("٢)"); s.editor.to = s.editor.from + 2;
  s.run("preview-selection"); s.button("Apply fixes").click(); assert.equal(s.editor.value, "١) أ\n2. ب\n٣) ج");
});
test("a selection inside code remains protected", () => {
  const s = setup("```\n١) code\n٢) code\n```\n١) أ\n٢) ب"); s.editor.from = 4; s.editor.to = 22; s.run("preview-selection");
  assert.equal(s.button("Apply fixes").disabled, true); assert.equal(s.editor.transactions.length, 0);
});
test("empty and multiple selections are refused", () => {
  const s = setup("١) أ\n٢) ب"); s.run("preview-selection"); assert.equal(s.notices.length, 1);
  s.editor.to = 8; s.editor.ranges = 2; s.run("preview-selection"); assert.equal(s.notices.length, 2);
  assert.equal(s.document.querySelectorAll(".idraaak-list-fixer").length, 0);
});
test("unload closes an open preview", () => {
  const s = setup("١) أ\n٢) ب"); s.run("preview-note"); s.plugin.onunload();
  assert.equal(s.document.querySelectorAll(".idraaak-list-fixer").length, 0); assert.equal(s.editor.transactions.length, 0);
});
test("opening a second preview closes the first", () => {
  const s = setup("١) أ\n٢) ب"); s.run("preview-note"); s.run("preview-note");
  assert.equal(s.document.querySelectorAll(".idraaak-list-fixer").length, 1);
});
test("large input cannot be applied", () => {
  const s = setup("x".repeat(1_000_001)); s.run("preview-note");
  assert.equal(s.button("Apply fixes"), undefined); assert.ok(s.document.body.textContent.includes("too large"));
});
