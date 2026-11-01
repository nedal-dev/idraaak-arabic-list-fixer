import { App, ButtonComponent, Editor, getLanguage, Modal, Notice, Plugin } from "obsidian";
import { MAX_FIXES, MAX_NOTE_LENGTH, planFixes, type Plan, type Scope } from "./core";

const en = {
  selection: "Preview Arabic list fixes in selection",
  note: "Preview Arabic list fixes in current note",
  title: "Preview Arabic list fixes",
  intro: "Only the numbered markers shown below will change. Item text, links and code are kept as written.",
  isolated: "Include isolated or nonconsecutive numbered lines",
  isolatedHelp: "Off by default. Enable only after checking that these lines are list items, not dates or prose.",
  before: "Before", after: "After", line: "Line", changes: "Markers to change",
  skipped: "Isolated lines skipped", cancel: "Cancel", apply: "Apply fixes", empty: "No matching list markers in this scope.",
  select: "Select text in one editor range first.", stale: "The note changed while the preview was open. Close it and run the command again.",
  done: "Arabic list markers updated. Use Undo to revert.",
  large: `This note is too large to preview (limit: ${MAX_NOTE_LENGTH.toLocaleString("en-US")} characters).`,
  many: `More than ${MAX_FIXES} markers match. Select a smaller section and try again.`,
  error: "Unable to preview this editor range. Close the preview and try again."
};
type Labels = typeof en;
const ar: Labels = {
  selection: "معاينة إصلاح القوائم العربية في النص المحدد",
  note: "معاينة إصلاح القوائم العربية في الملاحظة الحالية",
  title: "معاينة إصلاح القوائم العربية",
  intro: "ستتغير علامات الترقيم المعروضة فقط. يبقى نص البنود والروابط والأكواد كما هو.",
  isolated: "تضمين الأسطر المنفردة أو غير المتتابعة في الترقيم",
  isolatedHelp: "معطل افتراضيًا. فعّله بعد التأكد أن الأسطر بنود قائمة وليست تواريخ أو فقرات عادية.",
  before: "قبل", after: "بعد", line: "السطر", changes: "علامات الترقيم التي ستتغير",
  skipped: "الأسطر المنفردة المستثناة", cancel: "إلغاء", apply: "تطبيق الإصلاحات", empty: "لا توجد علامات قوائم مطابقة ضمن هذا النطاق.",
  select: "حدد النص في نطاق واحد داخل المحرر أولًا.", stale: "تغيرت الملاحظة أثناء فتح المعاينة. أغلقها ثم شغّل الأمر مجددًا.",
  done: "تم تحديث علامات القوائم العربية. يمكنك التراجع عن التغيير بأمر التراجع.",
  large: "الملاحظة أكبر من الحد المسموح للمعاينة وهو مليون محرف.",
  many: `عدد العلامات المطابقة يتجاوز ${MAX_FIXES}. حدد قسمًا أصغر ثم حاول مجددًا.`,
  error: "تعذرت معاينة هذا النطاق. أغلق المعاينة ثم حاول مجددًا."
};

class FixPreview extends Modal {
  private includeIsolated = false;
  private plan: Plan = { fixes: [], isolated: 0 };

  constructor(app: App, private editor: Editor, private snapshot: string, private editScope: Scope, private labels: Labels, private arabic: boolean, private closed: () => void) { super(app); }

  onOpen(): void {
    this.modalEl.addClass("idraaak-list-fixer");
    this.contentEl.setAttribute("dir", this.arabic ? "rtl" : "ltr");
    this.render();
  }

  private render(): void {
    const c = this.contentEl;
    c.empty();
    c.createEl("h2", { text: this.labels.title });
    c.createEl("p", { text: this.labels.intro });
    const option = c.createEl("label", { cls: "idraaak-list-option" });
    const checkbox = option.createEl("input", { type: "checkbox" });
    checkbox.checked = this.includeIsolated;
    option.createSpan({ text: this.labels.isolated });
    checkbox.addEventListener("change", () => {
      this.includeIsolated = checkbox.checked;
      this.render();
      this.contentEl.querySelector<HTMLInputElement>("input")?.focus();
    });
    c.createEl("p", { text: this.labels.isolatedHelp, cls: "setting-item-description" });
    try { this.plan = planFixes(this.snapshot, this.includeIsolated, this.editScope); }
    catch (error) {
      const message = error instanceof Error ? error.message : "";
      c.createEl("p", { text: message === "note-too-large" ? this.labels.large : message === "too-many-fixes" ? this.labels.many : this.labels.error });
      new ButtonComponent(c.createDiv({ cls: "idraaak-list-actions" })).setButtonText(this.labels.cancel).onClick(() => this.close());
      return;
    }
    c.createEl("p", { text: `${this.labels.changes}: ${this.plan.fixes.length} · ${this.labels.skipped}: ${this.includeIsolated ? 0 : this.plan.isolated}`, cls: "idraaak-list-count" });
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
    new ButtonComponent(actions).setButtonText(this.labels.cancel).onClick(() => this.close());
    new ButtonComponent(actions).setButtonText(this.labels.apply).setCta().setDisabled(this.plan.fixes.length === 0).onClick(() => this.apply());
  }

  private apply(): void {
    if (this.editor.getValue() !== this.snapshot) { new Notice(this.labels.stale); return; }
    if (this.plan.fixes.length === 0) return;
    this.editor.transaction({ changes: this.plan.fixes.map(fix => ({ from: this.editor.offsetToPos(fix.from), to: this.editor.offsetToPos(fix.to), text: fix.replacement })) });
    this.close();
    new Notice(this.labels.done);
  }

  onClose(): void { this.contentEl.empty(); this.closed(); }
}

export default class ArabicListFixer extends Plugin {
  private preview: FixPreview | undefined;

  private showPreview(editor: Editor, snapshot: string, scope: Scope, labels: Labels, arabic: boolean): void {
    this.preview?.close();
    const preview = new FixPreview(this.app, editor, snapshot, scope, labels, arabic, () => {
      if (this.preview === preview) this.preview = undefined;
    });
    this.preview = preview;
    preview.open();
  }

  onload(): void {
    const arabic = getLanguage().startsWith("ar");
    const labels = arabic ? ar : en;
    this.addCommand({ id: "preview-selection", name: labels.selection, editorCallback: editor => {
      if (editor.listSelections().length !== 1 || !editor.somethingSelected()) { new Notice(labels.select); return; }
      const snapshot = editor.getValue();
      const from = editor.posToOffset(editor.getCursor("from"));
      const to = editor.posToOffset(editor.getCursor("to"));
      this.showPreview(editor, snapshot, { from, to }, labels, arabic);
    } });
    this.addCommand({ id: "preview-note", name: labels.note, editorCallback: editor => {
      const snapshot = editor.getValue();
      this.showPreview(editor, snapshot, { from: 0, to: snapshot.length }, labels, arabic);
    } });
  }

  onunload(): void { this.preview?.close(); }
}
