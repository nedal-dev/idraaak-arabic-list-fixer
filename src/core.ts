/** Local, conservative text planning. No I/O and no changes to list item bodies. */
export interface Fix {
  from: number;
  to: number;
  replacement: string;
  line: number;
  before: string;
  after: string;
}

export interface Scope { from: number; to: number }
export interface Plan { fixes: Fix[]; isolated: number }
interface Line { text: string; start: number; body: string; prefix: string }
interface Candidate extends Fix { number: number; prefix: string; grouped: boolean }

export const MAX_NOTE_LENGTH = 1_000_000;
export const MAX_FIXES = 300;

function linesOf(text: string): Line[] {
  const chunks = text.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g) ?? [];
  let start = 0;
  const lines: Line[] = [];
  for (const chunk of chunks) {
    if (chunk === "") break;
    const line = chunk.replace(/(?:\r\n|\r|\n)$/, "");
    const parts = /^((?: {0,3}>[ \t]?)*)( {0,3})(.*)$/.exec(line);
    const prefix = (parts?.[1] ?? "") + (parts?.[2] ?? "");
    lines.push({ text: line, start, body: parts?.[3] ?? line, prefix });
    start += chunk.length;
  }
  return lines;
}

function latinDigits(text: string): string {
  return text.replace(/[\u0660-\u0669\u06f0-\u06f9]/g, digit => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

/** Scope uses UTF-16 offsets, the same units as the editor API. */
export function planFixes(text: string, includeIsolated = false, scope?: Scope): Plan {
  if (text.length > MAX_NOTE_LENGTH) throw new Error("note-too-large");
  const region = scope ?? { from: 0, to: text.length };
  if (!Number.isInteger(region.from) || !Number.isInteger(region.to) || region.from < 0 || region.to < region.from || region.to > text.length) {
    throw new Error("invalid-scope");
  }
  const lines = linesOf(text);
  const candidates: Candidate[] = [];
  let frontmatter = false;
  let fence: { char: string; length: number } | undefined;
  let math = false;
  let comment = false;
  let htmlTag: string | undefined;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const body = line.body;
    const trimmed = body.trimStart();
    if (index === 0 && /^\uFEFF?---\s*$/.test(line.text)) { frontmatter = true; continue; }
    if (frontmatter) {
      if (/^(?:---|\.\.\.)\s*$/.test(line.text)) frontmatter = false;
      continue;
    }
    if (fence) {
      const end = /^(`+|~+)\s*$/.exec(trimmed);
      if (end && end[1]![0] === fence.char && end[1]!.length >= fence.length) fence = undefined;
      continue;
    }
    if (comment) {
      if (body.includes("-->")) comment = false;
      continue;
    }
    if (htmlTag) {
      if (new RegExp(`</${htmlTag}\\s*>`, "i").test(body)) htmlTag = undefined;
      continue;
    }
    if (math) {
      if (body.includes("$$")) math = false;
      continue;
    }

    // A fence can also follow an enclosing list marker. Being conservative is intentional.
    const fenceBody = trimmed.replace(/^(?:[*+-]|[0-9\u0660-\u0669\u06f0-\u06f9]{1,9}[.)])[ \t]+/, "");
    const opening = /^(`{3,}|~{3,})(.*)$/.exec(fenceBody);
    if (opening) {
      fence = { char: opening[1]![0]!, length: opening[1]!.length };
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
      const tag = html[1]!.toLowerCase();
      const voidTag = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag);
      if (!voidTag && !trimmed.includes("/>") && !new RegExp(`</${tag}\\s*>`, "i").test(trimmed)) htmlTag = tag;
      continue;
    }
    // Four spaces and tabs can introduce code. Deeper list indentation is left alone.
    if (/^(?: {4}|\t)/.test(line.text) || /^[ \t]/.test(body)) continue;
    const marker = /^([\u0660-\u0669\u06f0-\u06f9]{1,9}[.)]|\([\u0660-\u0669\u06f0-\u06f9]{1,9}\))([ \t]+)(\S.*)$/.exec(body);
    if (!marker) continue;
    const original = marker[1]!;
    const number = Number(latinDigits(original.replace(/[().]/g, "")));
    const replacement = `${number}.`;
    const from = line.start + line.prefix.length;
    candidates.push({
      from, to: from + original.length, replacement, number,
      line: index + 1, before: line.text,
      after: line.prefix + replacement + body.slice(original.length),
      prefix: line.prefix, grouped: false
    });
  }

  // By default require an adjacent pair at the same indentation/quote depth.
  // Blank lines are accepted; normal paragraphs and nested material break a run.
  for (let i = 1; i < candidates.length; i++) {
    const previous = candidates[i - 1]!;
    const current = candidates[i]!;
    const between = lines.slice(previous.line, current.line - 1);
    const consecutive = current.number === previous.number + 1 || (current.number === 1 && previous.number === 1);
    if (previous.prefix === current.prefix && consecutive && between.every(line => line.body.trim() === "")) {
      previous.grouped = current.grouped = true;
    }
  }
  const inScope = candidates.filter(item => item.from >= region.from && item.to <= region.to);
  const isolated = inScope.filter(item => !item.grouped).length;
  const fixes = inScope.filter(item => item.grouped || includeIsolated).map(({ from, to, replacement, line, before, after }) => ({ from, to, replacement, line, before, after }));
  if (fixes.length > MAX_FIXES) throw new Error("too-many-fixes");
  return { fixes, isolated };
}
