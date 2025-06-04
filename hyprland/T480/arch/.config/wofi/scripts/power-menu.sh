#!/bin/bash

# Set the working directory to ~/.config/wofi
cd ~/.config/wofi

# Define menu options
options="Lock\nLogout\nReboot\nShutdown\nSuspend"

# Use Wofi to display the menu
selected=$(echo -e "$options" | wofi --show dmenu --prompt="Power Menu" --sort-order=alphabetical -i)

# Handle the selection
case "$selected" in
    Lock)
        hyprlock 
        ;;
    Logout)
        hyprctl dispatch exit
        ;;
    Reboot)
        systemctl reboot
        ;;
    Shutdown)
        systemctl poweroff
        ;;
    Suspend)
        systemctl suspend
        ;;
    *)
        exit 1
        ;;
esac
