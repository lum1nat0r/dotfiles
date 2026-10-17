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

## Zsh and Oh My Zsh

Zsh is installed with Arch's `zsh` package. Oh My Zsh is a shared, root-owned
checkout of <https://github.com/ohmyzsh/ohmyzsh> at
`/usr/local/share/oh-my-zsh`; it is not vendored into this repository.
Install that checkout before starting a shell with the managed `.zshrc`.

`E14/.zshrc` selects the `robbyrussell` theme and `git` plugin, preserves
`~/.local/bin` on `PATH`, and keeps caches under each user's cache directory.
Shell history and completion dumps remain local. Automatic framework updates
are disabled because ordinary users cannot modify the shared installation;
update it explicitly with:

```sh
sudo git -C /usr/local/share/oh-my-zsh pull --ff-only
```

The system setup sets `/usr/bin/zsh` as the login shell for the desktop user
and root, and as the `useradd --defaults --shell /usr/bin/zsh` default for new
accounts. `/etc/skel/.zshrc` and `/root/.zshrc` contain copies of the initial
configuration; Stow manages only the desktop user's `~/.zshrc`, so later edits
do not automatically update those system copies. Service accounts and
`/bin/sh` are unchanged.

Log out and back in to refresh the desktop's inherited `SHELL`; already running
shells remain unchanged. Interactive login smoke checks covered the desktop
user, root and a clean temporary home using `/etc/skel/.zshrc`, including
Oh My Zsh loading, Git aliases and completion security.


## What belongs in E14

The package contains explicitly reviewed configuration files:

- Bash interactive settings/login sourcing and Zsh/Oh My Zsh preferences.
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

The island autostart uses GLib's `gdbus wait` to start right-islands only after
music-island owns `io.Astal.music-island` on the session bus. AGS 3.1 writes every
`ags run` bundle to the same `$XDG_RUNTIME_DIR/ags.js`; concurrent starts can
therefore load the wrong widget. Keep this ordering when changing autostart.
If music-island fails before registering on D-Bus, right-islands waits for it.
GTK box spacing belongs in the TSX `spacing` property, not in GTK CSS.

The migration exercised real Stow deploy/restow/unstow and conflict handling in
an isolated target, verified all 21 live file links and preserved script modes,
checked Bash/Lua/Python/JSON syntax, parsed the deployed configuration with
`hyprland --verify-config`, and loaded the deployed `.bashrc` in interactive Bash.
The hook was checked with clean data, a synthetic staged token and a missing
scanner. No compositor reload, lock/authentication attempt or application
restart was needed for the file-link migration.

### Native power menu

`Super+P` runs `~/.config/hypr/scripts/power-menu.sh`; pseudo-tiling moves to
`Super+Shift+P`. `Super+R` keeps the existing Wofi application launcher and style.
The power menu's `power-menu.py` is a short-lived GTK3 surface, not a service.
It requires Python 3/PyGObject, GTK3 and the GtkLayerShell 0.1 introspection API.
Its stylesheet remains at `wofi/powermenu.css`; the app launcher does not load it.

Five equal 146×166 logical-pixel tiles form a compact, centered horizontal group
with 16px gaps, 48px icons above 17px labels and no enclosing frame. Arrow keys,
Home/End and Tab move focus; Enter/Space activate it and Escape cancels.
To compensate font sidebearings, all icons except Sleep have a 5px optical
left shift; captions and tile geometry remain centered and unchanged.
The `power-menu` layer namespace shares the `launcher-glass` blur rule with Wofi.
An overlay-layer surface anchored to every edge with exclusive zone -1 covers
the focused output, including Waybar, without changing panel reservations.
`hyprctl monitors -j` selects the focused output; no offset compensation is needed.
Confirmations use a compact centered button group over the same full-screen glass.

Lock runs `hyprlock --grace 0`. Sleep runs `systemctl suspend` and **does not
automatically lock the session**. Hibernate is not offered or dispatched.
Swap and system power settings are unchanged.

Logout, Shutdown and Reboot require a second dialog. `Abbrechen` is first;
only an explicit `Bestätigen` proceeds. Escape or an empty/unrecognized answer
does nothing. Logout uses `hyprshutdown` when installed, otherwise
`hyprctl dispatch 'hl.dsp.exit()'`; a failing installed `hyprshutdown` does not
trigger the fallback. Command failures retain their exit code and report the
diagnostic on stderr and via `notify-send`.

Before Hibernate was removed, an isolated temporary harness covered all six
actions, cancellation and failure paths in 27 scenarios without access to real
power commands. After removal, dispatch smoke checks covered the five remaining
actions and rejection of the former Hibernate selection. The actual GTK
widgets were rendered in an isolated Broadway display: equal tile dimensions,
16px gaps, symmetric side margins in a 1568px window, centered icon/label
alignment, keyboard navigation/activation and Enter-to-cancel were exercised.
Wayland layer-shell setup was bypassed only in that disposable layout harness.
Live desktop checks (blur, both monitors, overlay over Waybar and launcher style)
remain unverified because Computer control acquisition returned
`Computer session is closed`. No real power or lock action was exercised.

### VS Code credential storage on Hyprland

Install `gnome-keyring` and `libsecret`. Hyprland is not automatically detected
as a supported keyring desktop by VS Code, so use **Preferences: Configure
Runtime Arguments** and add `"password-store": "gnome-libsecret"` to the local
`~/.vscode/argv.json`, then fully quit and reopen VS Code.
Do not select **Use weaker encryption** or the `basic` backend.
See the [VS Code credential-store guide](https://code.visualstudio.com/docs/configure/settings-sync#_troubleshoot-credentialstore-issues).

Arch's SDDM PAM configuration already includes GNOME Keyring authentication and
session hooks. The package enables `gnome-keyring-daemon.socket` system-wide;
for an existing session, run `systemctl --user start gnome-keyring-daemon.socket`.
The login keyring must have the internal name `login` and use the same password
as the Linux account for automatic unlocking on password login. Fingerprint
login supplies no password, so unlock the keyring once per session when prompted.
An explicitly chosen empty keyring password avoids the unlock prompt, including
after fingerprint login, but stores keyring contents unencrypted on disk.
This changes only the keyring password, not the Linux account password.

Keep `argv.json` local because it also contains an installation identifier.
Keyrings under `~/.local/share/keyrings/` and VS Code account storage are private
runtime data and must never be added to this package.

Verification used a temporary VS Code extension and isolated user-data directory:
SecretStorage store/read/delete succeeded, and a stored test value was readable
after restarting VS Code. The initially encrypted keyring was subsequently
changed to an empty password at the user's request. Its file remains mode
`0600`, but is plaintext. Secret Service store/read succeeded after restarting
the daemon without a password prompt. A full desktop reboot was not exercised.

### Local dictation with Handy

Install `handy-bin` from the AUR and Arch's `wtype` package. The current
installation uses Handy 0.9.8; its reviewed AUR recipe repackages the upstream
release and verifies the downloaded sources with BLAKE2 checksums.
Updates belong to the package manager, not Handy's built-in updater.

`hyprland.lua` starts `handy --start-hidden` once per compositor session:

| Shortcut | Action |
| --- | --- |
| `Super+O` (hold) | Record while O is held; release O to stop and insert the transcription |
| `Super+Shift+O` | Cancel the current recording/operation without inserting text |

Use these Handy preferences:

| Setting | Value |
| --- | --- |
| Model | Parakeet V3 (`parakeet-tdt-0.6b-v3`, local CPU inference) |
| Language / translation | Automatic detection; translation to English off |
| Microphone | `pipewire`; PipeWire's default source is the UGREEN webcam |
| Recording | Push to talk; always-on microphone off |
| Paste method | External Script |
| External script | `$HOME/.config/hypr/scripts/handy-paste.py` (expand `$HOME` in the setting) |
| Overlay / feedback | Overlay off; audio feedback on at 40% |
| Auto-submit / post-processing | Both off |
| History / recording retention | Limit 0; preserve only entries within that limit |
| Model unload | After 5 minutes |
| Startup | Start hidden; Handy's own login autostart off (Hyprland owns it) |
| Update checks / logging | Built-in update checks off; log level Warn |

The paste helper uses `Ctrl+Shift+V` in Kitty and `Ctrl+V` elsewhere, then
restores the previous clipboard payload. Kitty's `Shift+Insert` reads the primary
selection, so it can insert unrelated selected text instead of the dictation.
Do not use Handy's Direct Input method with this German keyboard layout.
Keep the intended input field focused until transcription finishes.
Hyprland handles the press and release edges through Handy's external toggle
command. Releasing Super before O still stops on O release. Cancelling clears
the held state, so the later release cannot start another recording.

Handy's `~/.local/share/com.pais.handy/settings_store.json` remains local:
the same store can contain API keys and device-specific preferences.
Models, recordings, history databases, logs and WebKit state also stay outside
Stow. Only the compositor integration and paste helper are versioned.
The existing `cliphist` watcher can retain pasted dictations even with Handy's
history disabled; restoring the clipboard does not remove those history entries.

Verification exercised German synthetic speech through a temporary PipeWire
source into the real Handy recorder, then into Chromium, Kitty and an isolated
OMP composer without submitting a message. Clipboard text restoration passed;
Handy's history table and recording directory were empty afterward. Physical
microphone quality and a complete desktop relogin were not tested.
Push-to-talk verification used synthesized key-down/key-up events and an isolated
PipeWire source: recording remained active while held, stopped on release in
either modifier order, and stayed idle after a short tap or cancellation.

