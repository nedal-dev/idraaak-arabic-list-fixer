Initial development release of Idraaak Arabic List Fixer.

- Preview and convert Arabic-Indic/Persian numbered list markers into native Markdown.
- Commands for selected text or the current note, with explicit Apply and Cancel controls.
- Conservative default grouping, protected code/frontmatter/math/HTML, and stale-preview refusal.
- Arabic and English interface. Local processing without network requests or telemetry.

Requires Obsidian 1.14.5 or later. Download `main.js`, `manifest.json` and `styles.css` into the plugin directory described in the README.

Validation: 48 automated core and public-API/DOM-harness tests passed, plus type checking, production build and the official recommended Obsidian lint rules. The actual desktop app could not launch in the isolated test environment; desktop integration and real mobile devices remain unverified. See [VALIDATION.md](https://github.com/nedal-dev/idraaak-arabic-list-fixer/blob/main/VALIDATION.md). This release does not claim Community directory approval.

Publisher: [Idraaak](https://idraaak.com/). MIT license. AI assistance was used for code, documentation and tests.
