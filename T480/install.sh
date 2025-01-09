#!/bin/bash

echo "Installing packages via pacman and yay..."

# Define an array of packages to install via pacman
pacman_packages=(
    hyprland
    waybar
    hyprpaper
    python-pywal
    pavucontrol
    pipewire
    pipewire-pulse
    base-devel
    git
    brightnessctl
    hyprlock
    hypridle
    blueman
    swaync
)

# Install packages via pacman
for package in "${pacman_packages[@]}"; do
    sudo pacman -S --noconfirm $package
done

# Installing yay
if ! command -v yay &> /dev/null; then
    git clone https://aur.archlinux.org/yay.git
    cd yay
    makepkg -si --noconfirm
    cd ..
    rm -rf yay
fi

# Confirm the installation of yay
yay --version

# Define an array of packages to install via yay
yay_packages=(
    wofi
    getnf
    playerctl
    hyprpolkitagent
    hyprshot
    swaync-widgets-git
)

# Install packages via yay
for package in "${yay_packages[@]}"; do
    yay -S --noconfirm $package
done

# Install fonts using getnf
getnf JetBrainsMono Lekton

# Change chmod +x on all scripts (hypr/scripts, wofi/scripts, etc.)
chmod +x $HOME/.config/hypr/scripts/*
chmod +x $HOME/.config/wofi/scripts/*

# Restart pipewire
systemctl --user restart pipewire

# Copy .config files to $HOME/.config
cp -r .config/* $HOME/.config

echo "Finished with automated install. Now please follow the instructions below to finish the installation."
# wait for user input
read -p "Press enter to continue..."

###############################
#   Wallpaper-Installation    #
###############################

echo "To install wallpapers, create a directory in your home directory and copy the wallpapers into it via the following command:"
# Create wallpapers-dir
echo "mkdir $HOME/.local/share/wallpapers"

echo "Copy the wallpapers from your wallpaper directory into the newly created directory via the following command:"
# Copy wallpapers into the directory $HOME/.local/share/wallpapers
echo "cp <your_wallpaper_dir>/* $HOME/.local/share/wallpapers"

echo "Wallpaper installation finished. Next step is to install and configure libinput-gestures."
read -p "Press enter to continue..."

###############################
#     Libinput-gestures       #
###############################

echo "Install libinput-gestures by following the instructions below:"
# Install libinput-gestures
echo "sudo gpasswd -a $USER input"
echo "!!!Reboot the system and resume the installation process. Make sure to copy the instructions below and store it somewhere save, so you can finish the installation!!!"


echo "sudo pacman -S wmctrl xdotool"

# Install libinput-gestures
echo "yay -S libinput-gestures"

# Activate autostart and start libinput-gestures
echo "libinput-gestures-setup stop desktop autostart start"

# Install Font SF Pro Display Regular & Bold
