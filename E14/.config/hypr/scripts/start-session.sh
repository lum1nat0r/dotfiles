#!/bin/sh
set -eu

# The start event can precede Hyprland publishing its instance/PID file.
compositor_pid=$(timeout 5 sh -c '
    until { IFS= read -r pid < "$1"; } 2>/dev/null; do
        sleep 0.05
    done
    printf "%s\n" "$pid"
' sh "$XDG_RUNTIME_DIR/hypr/$HYPRLAND_INSTANCE_SIGNATURE/hyprland.lock") || {
    printf "%s\n" "Hyprland PID file was not ready within 5 seconds" >&2
    exit 1
}

# Stop old clients before replacing the user manager's display environment.
systemctl --user stop e14-session.target graphical-session.target e14-session-watch.service
dbus-update-activation-environment --systemd DISPLAY WAYLAND_DISPLAY XDG_CURRENT_DESKTOP XDG_SESSION_TYPE HYPRLAND_INSTANCE_SIGNATURE
systemctl --user set-environment E14_HYPRLAND_PID="$compositor_pid"
systemctl --user start e14-session.target
