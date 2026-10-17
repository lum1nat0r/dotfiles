"""Run from the repository root: python3 tests/session-start.py."""

import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
import unittest


STARTER = Path(__file__).resolve().parents[1] / "E14/.config/hypr/scripts/start-session.sh"


class SessionStartTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.lock = self.root / "hypr/current/hyprland.lock"
        self.lock.parent.mkdir(parents=True)
        self.effects = self.root / "effects"
        self.bin = self.root / "bin"
        self.bin.mkdir()
        # Real readiness loop; isolate only changes to the user's desktop session.
        for command in ("systemctl", "dbus-update-activation-environment"):
            shim = self.bin / command
            shim.write_text('#!/bin/sh\nprintf "effect\\n" >> "$EFFECTS"\n')
            shim.chmod(0o755)
        self.env = dict(
            os.environ,
            PATH=f"{self.bin}:{os.environ['PATH']}",
            XDG_RUNTIME_DIR=str(self.root),
            HYPRLAND_INSTANCE_SIGNATURE="current",
            EFFECTS=str(self.effects),
        )

    def test_waits_for_current_instance_and_complete_pid_line(self):
        other = self.root / "hypr/other/hyprland.lock"
        other.parent.mkdir()
        other.write_text("123\nwayland-other\n")
        self.lock.write_text("456")  # A first line without its terminating newline.
        process = subprocess.Popen(
            ["sh", str(STARTER)], env=self.env,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        )
        self.addCleanup(lambda: process.poll() is None and process.kill())
        premature = []

        def publish():
            time.sleep(0.2)
            premature.append(self.effects.exists())
            self.lock.write_text("456\nwayland-current\n")

        publisher = threading.Thread(target=publish)
        publisher.start()
        stdout, stderr = process.communicate(timeout=8)
        publisher.join()
        self.assertEqual(premature, [False], "session changed before its PID was ready")
        self.assertEqual(process.returncode, 0, stdout + stderr)

    def test_missing_pid_times_out_without_changing_session(self):
        result = subprocess.run(
            ["sh", str(STARTER)], env=self.env,
            capture_output=True, text=True, timeout=8,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Hyprland PID file was not ready within 5 seconds", result.stderr)
        self.assertFalse(self.effects.exists(), "failed readiness must not stop the desktop")


if __name__ == "__main__":
    unittest.main()
