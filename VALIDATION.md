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

## Not verified

The actual Obsidian desktop runtime could not start in the isolated execution environment: process-singleton socket creation returned `Operation not permitted`. The official Linux 1.14.5 distribution was obtained, but no successful app launch, real editor Undo, native modal keyboard behavior, screenshot, or in-app interaction is claimed. The public-API/DOM harness is not the desktop application.

Windows, macOS and actual Android/iOS devices have not been tested. `isDesktopOnly: false` reflects that the source uses only cross-platform Obsidian/DOM APIs; it is not a claim of completed mobile-device testing. Minimum app version is conservatively set to the current stable 1.14.5 instead of claiming support for older untested versions.

Directory approval, publication, backlink presence, search indexing and ranking impact are separate checks. This file does not claim any of them.

## Reproduce

```sh
npm ci --ignore-scripts
npm test
npm run lint
```

For a real-app smoke check, copy the release files into a disposable vault's plugin folder, enable the plugin, run both commands, inspect and cancel a preview, apply to a small Arabic list, use Undo, and verify that a stale preview refuses changes. Test Arabic and English app languages, as well as code-block exclusions. Do not use private notes as test fixtures.
