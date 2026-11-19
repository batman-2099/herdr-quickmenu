#!/usr/bin/env python3
"""Run validation helpers inside Herdr's actual JavaScript runtime, not Node.

Requires Python 3 and herdr-app. Does not install or activate a mod, touch the
clipboard, launch a browser, or change the current layout. This is not an
end-to-end selection test. Herdr checks execute initialization for real.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
mod = root / "mods" / "selected-actions-menu"
base = Path(os.environ.get("TMPDIR", str(Path.home() / ".cache" / "herdr-quickmenu")))
base.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix="quickmenu-tests-", dir=base) as temp:
    folder = Path(temp)
    for name in ("actions.js", "validation-tests.js"):
        shutil.copy2(mod / name, folder / name)
    (folder / "mod.json").write_text('{"place":"none"}\n')
    (folder / "main.js").write_text('''
import { View, div } from "gpui-kit";
import { validate } from "./validation-tests.js";
const passed = await validate();
export default class Validation extends View {
  init() {
    if (!passed.length) throw new Error("No tests executed");
    // check suppresses console output. A deliberate terminal diagnostic makes
    // completion observable; the runner accepts only this exact result marker.
    throw new Error("QUICKMENU_TEST_RESULTS=" + JSON.stringify(passed));
  }
  render() { return div().child("Validation completed"); }
}
''')
    result = subprocess.run(["herdr-app", "check", str(folder)], text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=60)
    print(result.stdout, end="")
    # The harness intentionally exits check with a completion diagnostic.
    # Any other error (including an assertion failure) lacks the marker.
    marker = "QUICKMENU_TEST_RESULTS="
    records = [line.split(marker, 1)[1] for line in result.stdout.splitlines() if marker in line]
    if len(records) != 1:
        raise SystemExit("FAIL: expected exactly one validation result")
    passed, _ = json.JSONDecoder().raw_decode(records[0])
    if not isinstance(passed, list) or not passed or len(set(passed)) != len(passed):
        raise SystemExit("FAIL: invalid or duplicate test results")
    print(f"PASS: {len(passed)} validation tests in Herdr runtime (not clipboard E2E)")
