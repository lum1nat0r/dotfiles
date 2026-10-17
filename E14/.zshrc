export ZSH=/usr/local/share/oh-my-zsh
ZSH_CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/oh-my-zsh"
# The shared installation is maintained by root.
zstyle ':omz:update' mode disabled
ZSH_THEME="robbyrussell"
plugins=(git)
source "$ZSH/oh-my-zsh.sh"

export PATH="$PATH:$HOME/.local/bin"
