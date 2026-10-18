#!/bin/bash

# Change to wofi-config directory
cd ~/.config/wofi

# Keep the lock out of applications started by wofi.
exec flock --nonblock --close "${XDG_RUNTIME_DIR:?}/wofi-launcher.lock" \
    wofi --show drun --allow-images