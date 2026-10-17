# dotfiles

Dotfiles and scripts for Arch Linux. **`E14/` is the active GNU Stow package.**
The older [Hyprland profiles](hyprland/) and [Sway template](sway/template/)
are retained as historical configurations; they are not part of the E14 deployment.

## Source of truth

The repository contains the real files. Stow creates relative symlinks from
`$HOME` to the files inside `E14/`, preserving their home-relative paths:

```text
~/.config/hypr/hyprland.lua -> <repo>/E14/.config/hypr/hyprland.lua
~/.bashrc                 -> <repo>/E14/.bashrc
```

Editing either path edits the same file. There is no copy-back or sync step.
Review and commit changes in this repository. Applications may also modify a
linked settings file: those changes need the same review as manual edits.
If an application replaces a symlink with a regular file, compare the two files
before restoring the link; do not overwrite either version blindly.

`.stowrc` targets `$HOME` and disables directory folding. Only individual files
are linked; application directories remain real directories. Newly generated
files in `~/.config` therefore stay outside the repository.

## Persistent assistant rule

`E14/.omp/agent/RULES.md` is linked to `~/.omp/agent/RULES.md`.
OMP loads it as a user-level sticky rule regardless of the working directory.
It tells the assistant to apply this dotfiles workflow whenever a task touches
`~/.config` or a managed dotfile, even if the user does not mention the repo.

The rule is versioned like the other configuration files; OMP databases,
credentials, session history and caches remain local. Changes take effect in
the next session or after `/new` or `/clear`. Native rule discovery must remain
enabled; `--no-rules` disables it, and named profiles use separate agent directories.

Loading was verified in real OMP startups from both `~/.config` and `/tmp`,
checking the assembled request before transport dispatch without model inference.

## Setup and deployment

On Arch Linux, install the deployment and secret-scanning tools:

```sh
sudo pacman -S --needed stow gitleaks
```

For the initial E14 migration, GNU Stow 2.4.1 and Gitleaks 8.30.1 were installed
under `~/.local` without root access. Stow was built from the GNU release;
the Gitleaks release archive was checked against its published SHA-256.
Keep `~/.local/bin` on `PATH` when using that installation.

Run these commands from the repository root:

```sh
git config --local core.hooksPath .githooks
stow --simulate --verbose E14
stow --verbose E14
```

Hook activation is local Git configuration, so repeat it after a new clone.
The pre-commit hook fails closed if Gitleaks is unavailable and scans the staged
diff with secret values redacted.

**Existing regular files are conflicts, not permission to overwrite them.**
Compare them first and move only reviewed originals to a private backup outside
the repository. Do not use `--adopt`, `--override`, or `stow *`.
The initial migration saved all 21 original files under
`~/.local/state/dotfiles-backup/<timestamp>-E14/`, with a private backup root.

After adding a reviewed file to the package, preview and apply new links:

```sh
stow --simulate --verbose --restow E14
stow --restow E14
```

Editing an already linked file does not require restowing. Reload only the
application that needs it; Stow itself does not restart applications.

To remove the managed links:

```sh
stow --simulate --verbose --delete E14
stow --delete E14
```

This does not delete the repository files, remove unrelated local files, or
automatically restore the original backup. Restore originals only after checking
for newer local changes.

## What belongs in E14

The package contains explicitly reviewed configuration files:

- Bash interactive settings and login sourcing.
- Hyprland Lua configuration, Hyprlock configuration and the Wofi launcher.
- Waybar, SwayNC and Wofi configuration/styles and the notification helper.
- The music-island and right-islands widget sources/styles/helpers.
- VS Code's CSS/JSONC formatter selections, KIO delete confirmation and
  pavucontrol preferences.
- OMP's global sticky rule for the dotfiles workflow.

Monitor, keyboard and other E14 hardware preferences intentionally stay in this
machine profile. Hyprlock's PAM/fingerprint settings are preserved unchanged;
credentials and biometric enrollment data are not included.

The following remain local and are not deployed or changed by Stow:

| Paths / class | Reason |
| --- | --- |
| Firefox profiles, Spotify data, PulseAudio cookie | Account/session data and credentials |
| OBS configuration and profiles | Preferences mixed with paths, scenes, device state and possible streaming credentials; sanitizing once would not prevent private data being written back |
| `QtProject.conf`, `dolphinrc`, `session/`, `dconf/user` | Mixed history, generated state or binary settings; not suitable for direct file linking |
| VS Code storage, history, model configuration; `.vscode/argv.json` | Workspace/account state or installation identifiers; only `Code/User/settings.json` is managed |
| Logs, caches, telemetry, backups, keys and shell history | Runtime/private data, not reproducible configuration |
| Empty directories and the comments-only `.bash_logout` | No configuration to deploy |

Widget artwork/telemetry caches remain outside the package. Runtime SSIDs,
media metadata, clipboard contents and notifications must not be saved into
repository files.

## Review and commit workflow

`.gitignore` denies new E14 files by default and admits only exact reviewed
paths. For a new file, inspect its contents and dependencies, copy only that
file into the package, and add its exact path to the allowlist.
Never use `git add -f` to bypass this boundary.

**Private files must not live inside `E14/`, even if Git ignores them.**
Stow does not use `.gitignore` as its deployment allowlist. Local overrides
belong outside the repository, using the application's native include mechanism
where available. Do not link a mixed public/private state file.

For the initial uncommitted import:

```sh
gitleaks dir --redact --no-banner E14
git add -- README.md .gitignore .stowrc .githooks/pre-commit E14
git diff --cached --stat
git diff --cached
git commit -m "Manage E14 dotfiles with GNU Stow"
```

For later edits, review `git diff -- E14`, stage only intended files, and inspect
`git diff --cached` before committing. The hook runs the secret scan, but cannot
reliably detect personal names, internal hosts, SSIDs, email addresses or private
paths. Review those manually, including values added by applications.

Before publishing, scan the complete Git history as well:

```sh
gitleaks git --redact --no-banner --log-opts=--all .
```

The initial scan found no Gitleaks findings in the existing nine commits or
the new E14 package. This is not a complete personal-data audit of the historical
profiles or Git author metadata. Ignore rules do not remove already tracked data.
If a real credential reaches a commit, revoke/rotate it first, then clean the
history before publishing.

## Runtime dependencies and verification

This package does not install the desktop or extensions. It expects the
Lua-capable Hyprland API used by the current configuration, Hyprlock/PAM,
AGS with GTK4/Astal, Python 3 available as `python`, Waybar, SwayNC, Wofi,
Kitty, Dolphin, NetworkManager, BlueZ, PipeWire/WirePlumber, playerctl,
clipboard/screenshot utilities, portals and the configured polkit agent.
VS Code formatter settings require `esbenp.prettier-vscode`.
The styles reference JetBrainsMono Nerd Font, Symbols Nerd Font and
Lekton Nerd Font Mono.

The migration exercised real Stow deploy/restow/unstow and conflict handling in
an isolated target, verified all 21 live file links and preserved script modes,
checked Bash/Lua/Python/JSON syntax, parsed the deployed configuration with
`hyprland --verify-config`, and loaded the deployed `.bashrc` in interactive Bash.
The hook was checked with clean data, a synthetic staged token and a missing
scanner. No compositor reload, lock/authentication attempt or application
restart was needed for the file-link migration.
