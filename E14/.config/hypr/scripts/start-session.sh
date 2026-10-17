#!/bin/sh
set -eu

compositor_pid=$(hyprctl -j instances | python3 -c '
import json, sys
print(next(item["pid"] for item in json.load(sys.stdin) if item["instance"] == sys.argv[1]))
' "$HYPRLAND_INSTANCE_SIGNATURE")

# Stop old clients before replacing the user manager's display environment.
systemctl --user stop e14-session.target graphical-session.target e14-session-watch.service
dbus-update-activation-environment --systemd DISPLAY WAYLAND_DISPLAY XDG_CURRENT_DESKTOP XDG_SESSION_TYPE HYPRLAND_INSTANCE_SIGNATURE
systemctl --user set-environment E14_HYPRLAND_PID="$compositor_pid"
systemctl --user start e14-session.target
