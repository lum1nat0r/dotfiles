#!/usr/bin/env python
"""Paste Handy dictation without confusing Kitty's primary selection."""

import json
import subprocess
import sys
import time

window = json.loads(subprocess.check_output(["hyprctl", "activewindow", "-j"]))
modifiers = ["ctrl", "shift"] if window.get("class") == "kitty" else ["ctrl"]

types = subprocess.run(
    ["wl-paste", "--list-types"], capture_output=True, check=False
)
# Match Handy's text-first restoration, with PNG support for copied screenshots.
available = types.stdout.decode().splitlines()
mime = next(
    (item for item in ("text/plain;charset=utf-8", "text/plain", "image/png") if item in available),
    available[0] if available else None,
)
previous = (
    subprocess.check_output(["wl-paste", "--no-newline", "--type", mime])
    if mime else None
)

try:
    subprocess.run(
        ["wl-copy", "--type", "text/plain;charset=utf-8"],
        input=sys.argv[1].encode(), check=True,
    )
    time.sleep(0.1)
    keys = ["wtype"]
    for modifier in modifiers:
        keys.extend(["-M", modifier])
    keys.extend(["-k", "v"])
    for modifier in reversed(modifiers):
        keys.extend(["-m", modifier])
    subprocess.run(keys, check=True)
    time.sleep(0.15)
finally:
    if previous is None:
        subprocess.run(["wl-copy", "--clear"], check=True)
    else:
        subprocess.run(["wl-copy", "--type", mime], input=previous, check=True)
