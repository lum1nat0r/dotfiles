#!/bin/bash

# Set the working directory to ~/.config/wofi
cd ~/.config/wofi

# Define menu options
options="Lock\nLogout\nReboot\nShutdown"

# Use Wofi to display the menu
selected=$(echo -e "$options" | wofi --show dmenu --prompt="Power Menu")

# Handle the selection
case "$selected" in
    Lock)
        hyprlock # Replace with your screen locker command
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
    *)
        exit 1
        ;;
esac
