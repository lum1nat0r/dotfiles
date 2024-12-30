#!/bin/sh

wallpaper_dir="$HOME/.local/share/wallpapers"
monitor=`hyprctl monitors | grep Monitor | awk '{print $2}'`

# Get all the files in the wallpaper directory (recursively)
wallpapers=$(find "$wallpaper_dir" -type f)

# Choose a random wallpaper
wallpaper=$(echo "$wallpapers" | shuf -n 1)

wal -i "$wallpaper" -n

ln -s ~/.cache/wal/colors-waybar.css ~/.config/wofi/colors-waybar.css

# Set the wallpaper
hyprctl hyprpaper unload all
hyprctl hyprpaper preload "$wallpaper"
hyprctl hyprpaper wallpaper "$monitor, $wallpaper"

bash restart-waybar.sh

# Copy the current wallpaper to $HOME/.cache/current_wallpaper (used by swaylock)
cp "$wallpaper" "$HOME/.cache/current_wallpaper"

