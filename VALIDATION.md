# Validation record

Initial version: 0.1.0. Date: 2026-11-01.

## Passed

- 35 Node.js tests of marker conversion, body preservation, default grouping, explicit isolated-line mode, Persian and Arabic-Indic digits, CRLF/CR handling, UTF-16 offsets, protected code/frontmatter/math/HTML, selection boundaries, idempotence and size limits.
- 13 tests of the compiled plugin in a public-API/DOM harness using jsdom. These exercise preview-only behavior, Cancel, a single apply transaction, stale-note refusal, the optional isolated-line control, Arabic UI/RTL, rendering pasted HTML as plain text, selection protection, empty/multiple selections, closing on unload, replacing an open preview and large-input refusal.
- TypeScript type checking against the published Obsidian 1.14.4 API declarations.
- ESLint with the official `eslint-plugin-obsidianmd` 0.4.2 recommended configuration: no reported errors or warnings.
- Production bundling with esbuild 0.28.2. Only `obsidian` remains an external runtime import; development dependencies are not shipped with the plugin.
- Source and metadata were checked for accidental invisible direction marks. The plugin's Arabic interface uses native `dir` attributes, not hidden Unicode marks.

`npm test` runs the production build and all 48 tests. `npm run lint` runs the recommended policy-oriented lint checks. The lockfile records exact dependency resolution.

## Real Linux app smoke check

The official Linux Obsidian 1.14.5 app passed a separate smoke check on a GitHub-hosted Ubuntu runner under Xvfb, in English and Arabic. The app archive was verified against its published SHA-256. The test used the official CLI and disposable synthetic notes, with the exact compiled files attached to version 0.1.0; no private vault was accessed.

Both language runs verified that preview leaves the note unchanged, Cancel preserves it, Apply converts only the intended markers while retaining body digits, URLs and fenced code, the real editor's Undo restores the original, a stale preview refuses changes, and the selection command changes only the selected marker. The checks used the localized button labels in the real modal.

Evidence: [successful workflow](https://github.com/nedal-dev/idraaak-arabic-list-fixer/actions/runs/41320650689), [result JSON](https://github.com/nedal-dev/idraaak-arabic-list-fixer/releases/download/0.1.0/smoke-result.json), [English preview](https://github.com/nedal-dev/idraaak-arabic-list-fixer/releases/download/0.1.0/preview-en.png) and [Arabic preview](https://github.com/nedal-dev/idraaak-arabic-list-fixer/releases/download/0.1.0/preview-ar.png). Test driver: `automation/native-smoke.py` at commit `d1b39150f424ec454c5eb42730ba0e4afc60d397`.

The original local execution environment could not start Electron because process-singleton socket creation returned `Operation not permitted`. Earlier CI attempts corrected test-driver startup, editor-session and locale setup; no plugin runtime files changed between those attempts and the successful run. The public-API/DOM harness remains a separate layer from this native app check.

## Not verified

Windows, macOS and actual Android/iOS devices have not been tested. `isDesktopOnly: false` reflects that the source uses only cross-platform Obsidian/DOM APIs; it is not a claim of completed mobile-device testing. Minimum app version is conservatively set to the current stable 1.14.5 instead of claiming support for older untested versions.

The native check covers the scripted cases above, not every editor mode, theme, keyboard shortcut, accessibility interaction or possible plugin combination. Native modal keyboard behavior has not been systematically tested.

Directory approval, publication, backlink presence, search indexing and ranking impact are separate checks. This file does not claim any of them.

## Reproduce

```sh
npm ci --ignore-scripts
npm test
npm run lint
```

For a real-app smoke check, copy the release files into a disposable vault's plugin folder, enable the plugin, run both commands, inspect and cancel a preview, apply to a small Arabic list, use Undo, and verify that a stale preview refuses changes. Test Arabic and English app languages, as well as code-block exclusions. Do not use private notes as test fixtures.
