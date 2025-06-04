# T480 Configuration

This folder contains all the configuration for my Arch-Linux and Hyprland installation on my Lenovo T480.

## Installation

The folder contains a script `install.sh` that automatically installs all the dependencies and copies the configs in the correct folders. For the best outcome this script should be run on a fresh Arch-installation with pipewire as audio-driver.

```shell
git clone git@github.com:lum1nat0r/dotfiles.git
cd T480
./install.sh
```

## Troubleshooting

### VSCode can't store encrypted data securely

Currently VSCode (installed via `yay -S visual-studio-code-bin`) has issues with recognizing Wayland and the default wallet to store encrypted data. To fix this do the following:

1. Open VSCode
2. Open command pallete (CTRL + SHIFT + P)
3. Search for `Preferences: Configure Runtime Arguments`
4. Add the following line: `"password-store": "kwallet6",`
5. Restart VSCode
