import test from "node:test";
import assert from "node:assert/strict";
import { planFixes, MAX_NOTE_LENGTH, MAX_FIXES } from "../.test-build/core.mjs";

function result(input, isolated = false, scope) {
  const plan = planFixes(input, isolated, scope);
  let output = input;
  for (const fix of [...plan.fixes].reverse()) output = output.slice(0, fix.from) + fix.replacement + output.slice(fix.to);
  return { ...plan, output };
}

test("Arabic-Indic parenthesis markers become native Markdown", () => {
  const a = result("١) افتح الإعدادات\n٢) اختر الشبكة\n٣) راجع النتيجة");
  assert.equal(a.output, "1. افتح الإعدادات\n2. اختر الشبكة\n3. راجع النتيجة");
  assert.equal(a.fixes.length, 3);
});
test("Persian digits and wrapped markers", () => {
  assert.equal(result("(۱) نخست\n(۲) سپس").output, "1. نخست\n2. سپس");
});
test("Arabic dot markers preserve item content verbatim", () => {
  const body = "https://idraaak.com/شرح/?x=١&y=٢ `let n = ٣` [[ملف ٤]] **٢٠٢٦**";
  assert.equal(result(`١. ${body}\n٢. ${body}`).output, `1. ${body}\n2. ${body}`);
});
test("default skips isolated years and nonconsecutive numeric prose", () => {
  const input = "٢٠٢٦. حدث شيء\n\nفقرة أخرى\n\n٣) بند منفرد\n٧) رقم مختلف";
  const a = result(input);
  assert.equal(a.output, input);
  assert.equal(a.isolated, 3);
});
test("explicit isolated option is available", () => {
  assert.equal(result("٥) بند", true).output, "5. بند");
});
test("empty items are not converted", () => {
  assert.equal(result("١) \n٢)\n٣.  ", true).fixes.length, 0);
});
test("ordinary body numbers never change", () => {
  assert.equal(result("النص ١٢٣\nالنسخة ٢.١.٠\nhttps://example.org/١٢٣\n`١) مثال`", true).fixes.length, 0);
});
test("existing Latin list markers are untouched", () => {
  assert.equal(result("1. First\n2) Second\n(3) Third", true).fixes.length, 0);
});
test("blank lines between adjacent items", () => {
  assert.equal(result("١) أ\n\n٢) ب").output, "1. أ\n\n2. ب");
});
test("repeated one markers keep original numbers", () => {
  assert.equal(result("١) أ\n١) ب").output, "1. أ\n1. ب");
});
test("zero and leading zeros are valid list starts", () => {
  assert.equal(result("٠٠) أ\n٠١) ب").output, "0. أ\n1. ب");
});
test("nine-digit limit follows native Markdown", () => {
  assert.equal(result("١٢٣٤٥٦٧٨٩) أ", true).output, "123456789. أ");
  assert.equal(result("١٢٣٤٥٦٧٨٩٠) أ", true).fixes.length, 0);
});
test("CRLF line endings remain exact", () => {
  assert.equal(result("١) أ\r\n٢) ب\r\n").output, "1. أ\r\n2. ب\r\n");
});
test("CR line endings remain exact", () => {
  assert.equal(result("١) أ\r٢) ب\r").output, "1. أ\r2. ب\r");
});
test("indentation and whitespace remain exact", () => {
  assert.equal(result("  ١)\tأ\n  ٢)  ب").output, "  1.\tأ\n  2.  ب");
});
test("blockquotes are supported", () => {
  assert.equal(result("> ١) أ\n>\n> ٢) ب").output, "> 1. أ\n>\n> 2. ب");
});
test("different containers cannot form a default pair", () => {
  assert.equal(result("١) أ\n> ٢) ب").fixes.length, 0);
});
test("backtick and tilde fences are protected", () => {
  for (const fence of ["```", "~~~", "````"]) {
    const input = `${fence}text\n١) code\n٢) code\n${fence}\n١) text\n٢) text`;
    assert.equal(result(input).fixes.length, 2);
    assert.ok(result(input).output.includes("١) code\n٢) code"));
  }
});
test("shorter and wrong fence markers do not close a fence", () => {
  assert.equal(result("````\n```\n١) code\n٢) code\n~~~\n٣) code", true).fixes.length, 0);
});
test("fences inside a list and a quote are protected", () => {
  for (const input of ["- ```\n  ١) code\n  ٢) code\n  ```", "> ```\n> ١) code\n> ٢) code\n> ```"]) assert.equal(result(input, true).fixes.length, 0);
});
test("indented code is left alone", () => {
  assert.equal(result("    ١) code\n    ٢) code\n\t٣) code", true).fixes.length, 0);
});
test("YAML frontmatter and a BOM are protected", () => {
  for (const bom of ["", "\uFEFF"]) {
    const input = `${bom}---\n١) metadata\n٢) metadata\n---\n١) أ\n٢) ب`;
    assert.equal(result(input).fixes.length, 2);
  }
});
test("unclosed frontmatter remains protected", () => {
  assert.equal(result("---\n١) metadata\n٢) metadata", true).fixes.length, 0);
});
test("math blocks are protected", () => {
  assert.equal(result("$$\n١) math\n٢) math\n$$\n١) أ\n٢) ب").fixes.length, 2);
});
test("comments and raw HTML blocks are protected", () => {
  for (const [open, close] of [["<!--", "-->"], ["<div>", "</div>"], ["<pre>", "</pre>"], ["<custom-widget>", "</custom-widget>"]]) {
    assert.equal(result(`${open}\n١) code\n٢) code\n${close}\n١) أ\n٢) ب`).fixes.length, 2);
  }
});
test("void HTML tags do not hide subsequent lists", () => {
  assert.equal(result("<br>\n١) أ\n٢) ب").fixes.length, 2);
});
test("existing direction marks are neither added nor removed", () => {
  const input = "\u200F١) أ\n\u200F٢) ب\n١) نص \u2066WiFi\u2069\n٢) ب";
  assert.ok(result(input).output.startsWith("\u200F١) أ\n\u200F٢) ب"));
  assert.ok(result(input).output.includes("\u2066WiFi\u2069"));
});
test("selection uses full-note protection even when it starts inside a fence", () => {
  const input = "```\n١) code\n٢) code\n```\n١) أ\n٢) ب";
  assert.equal(result(input, true, { from: input.indexOf("١) code"), to: input.indexOf("٢) code") + 7 }).fixes.length, 0);
});
test("selection changes only markers wholly inside the requested range", () => {
  const input = "١) أ\n٢) ب\n٣) ج";
  const from = input.indexOf("٢)");
  const a = result(input, false, { from, to: from + 2 });
  assert.equal(a.output, "١) أ\n2. ب\n٣) ج");
  assert.equal(result(input, true, { from: from + 1, to: from + 2 }).fixes.length, 0);
});
test("UTF-16 offsets remain correct after emoji and non-BMP text", () => {
  assert.equal(result("🙂 عنوان\n١) أ🙂\n٢) ب").output, "🙂 عنوان\n1. أ🙂\n2. ب");
});
test("conversion is idempotent", () => {
  const once = result("١) أ\n٢) ب\n٣) ج").output;
  assert.equal(result(once, true).fixes.length, 0);
});
test("all planned changes affect only the marker substring", () => {
  const input = "# عنوان\n\n١) **بند** ١٢٣\n٢) [رابط](https://example.org/٢)\n\nنهاية";
  const a = result(input);
  let previous = 0;
  for (const fix of a.fixes) {
    assert.ok(fix.from >= previous && fix.to > fix.from);
    assert.match(input.slice(fix.from, fix.to), /^[\u0660-\u0669\u06f0-\u06f9().]+$/);
    assert.match(fix.replacement, /^\d{1,9}\.$/);
    previous = fix.to;
  }
  assert.equal(a.output, "# عنوان\n\n1. **بند** ١٢٣\n2. [رابط](https://example.org/٢)\n\nنهاية");
});
test("invalid scopes are rejected", () => {
  for (const scope of [{ from: -1, to: 2 }, { from: 2, to: 1 }, { from: 0, to: 99 }, { from: 0.5, to: 1 }]) assert.throws(() => planFixes("abc", true, scope), /invalid-scope/);
});
test("oversize notes and excessive changes are rejected", () => {
  assert.throws(() => planFixes("x".repeat(MAX_NOTE_LENGTH + 1)), /note-too-large/);
  assert.throws(() => planFixes(Array(MAX_FIXES + 1).fill("١) بند").join("\n")), /too-many-fixes/);
});
test("empty text is safe", () => {
  assert.deepEqual(planFixes(""), { fixes: [], isolated: 0 });
});
