export ZSH=/usr/local/share/oh-my-zsh
ZSH_CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/oh-my-zsh"
# The shared installation is maintained by root.
zstyle ':omz:update' mode disabled
ZSH_THEME=""
plugins=(git)
source "$ZSH/oh-my-zsh.sh"

export PATH="$PATH:$HOME/.local/bin"

alias ssh-dark-factory='ssh thomas@v2202608113225502952.quicksrv.de'
# Optional help text for Super+H; the alias command itself stays the source of truth.
typeset -gA alias_descriptions
alias_descriptions[ssh-dark-factory]='Per SSH mit dem Dark-Factory-Server verbinden'

source <(fzf --zsh)
eval "$(zoxide init zsh)"
eval "$(starship init zsh)"
source /usr/share/zsh/plugins/zsh-autosuggestions/zsh-autosuggestions.zsh
# Keep highlighting after integrations that register line-editor widgets.
source /usr/share/zsh/plugins/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
