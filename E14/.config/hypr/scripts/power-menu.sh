#!/bin/bash

menu="$HOME/.config/hypr/scripts/power-menu.py"
selection=$(python3 "$menu") || exit 0

case "$selection" in
    '  Lock')
        action=Lock
        command=(hyprlock --grace 0)
        ;;
    '  Logout')
        action=Logout
        if command -v hyprshutdown >/dev/null 2>&1; then
            command=(hyprshutdown)
        else
            command=(hyprctl dispatch 'hl.dsp.exit()')
        fi
        ;;
    '  Sleep')
        action=Sleep
        command=(systemctl suspend)
        ;;
    '  Shutdown')
        action=Shutdown
        command=(systemctl poweroff)
        ;;
    '  Reboot')
        action=Reboot
        command=(systemctl reboot)
        ;;
    *) exit 0 ;;
esac

case "$action" in
    Logout|Shutdown|Reboot)
        confirmation=$(python3 "$menu" --confirm "$action") || exit 0
        [[ "$confirmation" == 'Bestätigen' ]] || exit 0
        ;;
esac

if diagnose=$("${command[@]}" 2>&1); then
    exit 0
else
    status=$?
    [[ -n "$diagnose" ]] || diagnose="Exitcode $status"
    printf '%s fehlgeschlagen: %s\n' "$action" "$diagnose" >&2
    notify-send --urgency=critical 'Power-Menü' "$action fehlgeschlagen: $diagnose" || :
    exit "$status"
fi
