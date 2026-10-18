export ZSH=/usr/local/share/oh-my-zsh
ZSH_CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/oh-my-zsh"
# The shared installation is maintained by root.
zstyle ':omz:update' mode disabled
ZSH_THEME=""
plugins=(git)
source "$ZSH/oh-my-zsh.sh"

export PATH="$PATH:$HOME/.local/bin"

source <(fzf --zsh)
eval "$(zoxide init zsh)"
eval "$(starship init zsh)"
source /usr/share/zsh/plugins/zsh-autosuggestions/zsh-autosuggestions.zsh
# Keep highlighting after integrations that register line-editor widgets.
source /usr/share/zsh/plugins/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
