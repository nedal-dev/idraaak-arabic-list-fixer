# Idraaak Arabic List Fixer

Preview Arabic-Indic numbered list markers and convert them into native Markdown lists. Useful when copied Arabic or Persian instructions arrive as plain paragraphs instead of a list.

```text
Before                     After
١) افتح الإعدادات           1. افتح الإعدادات
٢) اختر الشبكة             2. اختر الشبكة
```

The plugin changes only a line's numbered marker. The item text, body digits, links, wikilinks, inline code and line endings stay as written. Every change requires a preview and an explicit **Apply fixes** action. It does not run automatically on paste, startup or save.

## Use

1. Open a Markdown note in editing mode.
2. Select the relevant text, then run **Idraaak Arabic List Fixer: Preview Arabic list fixes in selection** from the command palette. Alternatively, use **Preview Arabic list fixes in current note**.
3. Review the before/after lines. By default, only adjacent consecutive numbered items (or repeated `١` items), with optional blank lines between them, are proposed.
4. If needed, enable **Include isolated or nonconsecutive numbered lines**. Check these lines carefully: a numbered line can be a year or ordinary prose.
5. Choose **Apply fixes**, or **Cancel**. The editor's Undo command reverts an applied conversion.

If you edit the note while a preview is open, the plugin refuses to apply the stale plan. Close the preview and run the command again.

The interface follows Obsidian's language: Arabic for Arabic app locales, otherwise English. You can use the plugin on Arabic and Persian text with either interface language.

## Supported markers

- Arabic-Indic digits `٠١٢٣٤٥٦٧٨٩` and Eastern Arabic-Indic/Persian digits `۰۱۲۳۴۵۶۷۸۹`.
- Markers such as `١.`, `١)`, `(١)`, `۱.` and `(۱)`, followed by whitespace and nonempty item text.
- Zero to nine-digit marker values. Leading zeros are normalized; values are preserved, not renumbered.
- Up to three spaces of indentation and blockquote prefixes such as `> ١)`.
- Native output uses Latin digits followed by a dot, for example `1. `, because these are Markdown list markers. Arabic digits inside the item body are not converted.

The two command scopes use the entire note to detect protected regions, even when the selection begins inside a code fence. A selection changes only marker substrings wholly inside its range.

## Conservative exclusions and limits

The plugin skips fenced code, four-space or tab-indented code, leading YAML frontmatter, block math delimited with `$$`, HTML comments and raw HTML blocks. An unclosed protected block conservatively protects the rest of the note. Lines that already start with a direction-control character are left alone; the plugin does not insert or remove invisible direction marks.

This is a conservative marker converter, not a complete Markdown formatter. Deeply indented nested lists, lists interrupted by continuation paragraphs, HTML with unusual nesting, custom Markdown syntax and isolated lines may need manual review. The optional isolated-line switch cannot make every numbered sentence a reliable list item. Existing Latin list markers are left unchanged. Multi-range selections are not supported.

Previews are limited to notes of 1,000,000 UTF-16 code units and at most 300 changes. For larger input, split the note or select a smaller section; the note-size limit applies to the whole open note.

## Install

Until an official Community directory listing is approved, install manually in a test vault:

1. Download `main.js`, `manifest.json` and `styles.css` from a GitHub release.
2. Place them in `<vault>/.obsidian/plugins/idraaak-arabic-list-fixer/`.
3. In Obsidian, enable community plugins, then enable **Idraaak Arabic List Fixer**.

Requires Obsidian 1.14.5 or later. Compatibility claims and actual tested platforms are listed in [VALIDATION.md](VALIDATION.md). The source avoids Node.js and Electron APIs and is designed for desktop and mobile, but mobile must not be treated as tested unless that validation file says so.

## Privacy

Free and local. The plugin makes no network requests, has no telemetry, does not read the system clipboard, does not scan the vault or access files outside it, and requires no account, API key or paid service. It reads the current editor text when a command is invoked and changes only the previewed markers after confirmation. Installing the app/plugin or downloading updates from GitHub may involve the app's normal network traffic; that is separate from this plugin's processing.

## Development

```sh
npm ci --ignore-scripts
npm test
npm run lint
npm run build
```

Runtime dependency: Obsidian's public plugin API. Build and test tools are development dependencies only. The output is unminified and can be rebuilt from the committed source and lockfile. No third-party plugin implementation was copied or forked. AI assistance was used for implementation, documentation and test preparation; see the validation record for what was actually checked.

## Publisher and support

Published by [Idraaak](https://idraaak.com/). This is an independent community project and is not an official Obsidian product.

Report reproducible problems through this repository's Issues, using a small non-sensitive Markdown sample and your app/plugin versions. Do not attach private notes or credentials.

MIT license. See [LICENSE](LICENSE).
