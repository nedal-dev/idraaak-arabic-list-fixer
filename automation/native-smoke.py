"""Run the compiled plugin in a disposable, real Obsidian app via its official CLI."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time

app_binary, cli_binary = map(lambda p: str(Path(p).resolve()), sys.argv[1:3])
repo = Path.cwd()
output = repo / "validation" / "native"
output.mkdir(parents=True, exist_ok=True)
plugin_id = "idraaak-arabic-list-fixer"
results = []
for language in ["en", "ar"]:
    base = Path(tempfile.mkdtemp(prefix="idraaak-obsidian-"))
    vault = base / "Test Vault"
    plugin_dir = vault / ".obsidian" / "plugins" / plugin_id
    plugin_dir.mkdir(parents=True)
    for name in ["main.js", "manifest.json", "styles.css"]:
        shutil.copy2(repo / name, plugin_dir / name)
    (vault / "Arabic.md").write_text("# Synthetic test note\n", encoding="utf-8")
    (vault / ".obsidian" / "app.json").write_text(json.dumps({"safeMode": False, "livePreview": False}))
    (vault / ".obsidian" / "community-plugins.json").write_text(json.dumps([plugin_id]))
    config = base / "config" / "obsidian"
    config.mkdir(parents=True)
    vault_id = "49f3dfe4ce3aa001"
    (config / "obsidian.json").write_text(json.dumps({
        "vaults": {vault_id: {"path": str(vault), "ts": int(time.time() * 1000), "open": True}},
        "cli": True, "language": language, "updateDisabled": True, "disableGpu": True
    }))
    env = os.environ.copy()
    env["XDG_CONFIG_HOME"] = str(base / "config")
    runtime = base / "runtime"
    runtime.mkdir(mode=0o700)
    env["XDG_RUNTIME_DIR"] = str(runtime)
    log = (output / f"app-{language}.log").open("w")
    app = subprocess.Popen([app_binary, "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"], env=env, stdout=log, stderr=log)

    def cli(*args):
        return subprocess.run([cli_binary, f"vault={vault_id}", *args], env=env, text=True, capture_output=True, timeout=15)

    def evaluate(code, sentinel):
        response = cli("eval", "code=" + code)
        if sentinel not in response.stdout:
            raise RuntimeError(f"Missing {sentinel}: {response.stdout}\n{response.stderr}")
        return response.stdout.strip()

    try:
        last_ready = "No CLI response"
        for attempt in range(40):
            time.sleep(1)
            if app.poll() is not None:
                raise RuntimeError(f"App exited: {(output / f'app-{language}.log').read_text()[-6000:]}")
            try:
                ready = cli("eval", 'code=JSON.stringify({ready:app.workspace.layoutReady,plugin:!!app.plugins.getPlugin("idraaak-arabic-list-fixer")})')
                last_ready = ready.stdout + "\n" + ready.stderr
                (output / f"cli-ready-{language}.log").write_text(last_ready)
                if '"ready":true' in ready.stdout:
                    break
            except subprocess.TimeoutExpired:
                continue
        else:
            raise RuntimeError("App/plugin did not become ready: " + last_ready)
        # Explicitly enable this locally built plugin in the disposable test vault.
        # App startup can keep community plugins restricted despite app.json.
        unrestricted = cli("plugins:restrict", "off")
        time.sleep(2)  # Let the app finish the requested vault reload.
        enabled = cli("plugin:enable", "id=" + plugin_id)
        print("Test-vault plugin setup:", unrestricted.stdout.strip(), enabled.stdout.strip(), flush=True)
        evaluate('app.plugins.getPlugin("idraaak-arabic-list-fixer") ? "PLUGIN_READY" : "PLUGIN_NOT_LOADED"', "PLUGIN_READY")
        prepare = r'''(async () => {
          const leaf = app.workspace.getLeaf(false);
          await leaf.openFile(app.vault.getAbstractFileByPath('Arabic.md'));
          const editor = leaf.view.editor;
          editor.setValue('١) افتح الإعدادات WiFi ٢٠٢٦\n٢) راجع [الموقع](https://example.org/١)\n\n```text\n١) code\n٢) code\n```');
          await new Promise(resolve => setTimeout(resolve, 600));
          app.commands.executeCommandById('idraaak-arabic-list-fixer:preview-note');
          const modal = document.querySelector('.idraaak-list-fixer');
          if (!modal || modal.querySelectorAll('pre').length !== 4) throw Error('Preview mismatch');
          if (editor.getValue().startsWith('1.')) throw Error('Preview edited the note');
          return 'PREVIEW_READY';
        })()'''
        labels = {"cancel": "إلغاء", "apply": "تطبيق الإصلاحات"} if language == "ar" else {"cancel": "Cancel", "apply": "Apply fixes"}
        finish = r'''(() => {
          const original = editor.getValue();
          const button = text => Array.from(document.querySelectorAll('.idraaak-list-fixer button')).find(b => b.textContent === text);
          const labels = LABELS;
          button(labels.cancel).click();
          if (editor.getValue() !== original) throw Error('Cancel changed text');
          app.commands.executeCommandById('idraaak-arabic-list-fixer:preview-note');
          button(labels.apply).click();
          if (!editor.getValue().startsWith('1. افتح الإعدادات WiFi ٢٠٢٦\n2. راجع [الموقع](https://example.org/١)')) throw Error('Apply mismatch');
          if (!editor.getValue().includes('١) code\n٢) code')) throw Error('Code changed');
          editor.undo();
          if (editor.getValue() !== original) throw Error('Undo did not restore original');
          app.commands.executeCommandById('idraaak-arabic-list-fixer:preview-note');
          editor.setValue(original + '\nتغيير جديد');
          const changed = editor.getValue();
          button(labels.apply).click();
          if (editor.getValue() !== changed) throw Error('Stale preview applied');
          button(labels.cancel).click();
          editor.setValue('١) أ\n٢) ب\n٣) ج');
          editor.setSelection({line:1,ch:0},{line:1,ch:2});
          app.commands.executeCommandById('idraaak-arabic-list-fixer:preview-selection');
          button(labels.apply).click();
          if (editor.getValue() !== '١) أ\n2. ب\n٣) ج') throw Error('Selection scope failed');
          editor.setValue(original);
          app.commands.executeCommandById('idraaak-arabic-list-fixer:preview-note');
          return 'NATIVE_SMOKE_OK';
        })()'''.replace("LABELS", json.dumps(labels, ensure_ascii=False))
        # Keep the same real editor reference throughout one CLI evaluation.
        finish_body = finish.removeprefix("(() => {").removesuffix("})()")
        evaluate(prepare.replace("return 'PREVIEW_READY';", finish_body), "NATIVE_SMOKE_OK")
        screenshot = output / f"preview-{language}.png"
        time.sleep(1)
        shot = cli("dev:screenshot", "path=" + str(screenshot))
        if shot.returncode != 0 or not screenshot.exists() or screenshot.stat().st_size < 1000:
            print("Optional screenshot unavailable:", shot.stdout[:1000], shot.stderr[:1000], flush=True)
            screenshot.unlink(missing_ok=True)
        results.append({"language": language, "version": "1.14.5", "result": "passed", "preview": screenshot.name if screenshot.exists() else None})
        print(json.dumps(results[-1]), flush=True)
    finally:
        app.terminate()
        try:
            app.wait(timeout=10)
        except subprocess.TimeoutExpired:
            app.kill()
        log.close()

(output / "smoke-result.json").write_text(json.dumps(results, ensure_ascii=False, indent=2))
