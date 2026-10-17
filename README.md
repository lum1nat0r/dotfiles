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

## Image viewer

Gwenview is the image viewer, with Qt/KDE format plugins for WebP, TIFF, AVIF,
JPEG XL and other formats:

```sh
sudo pacman -S --needed gwenview kimageformats qt6-imageformats
```

`E14/.config/mimeapps.list` makes Gwenview the default for common image formats.
PDF and directory associations are not overridden. Gwenview's own settings,
recent-file history and caches remain local; only the reviewed MIME defaults
are managed by Stow.

MuPDF supports PDF and images including PNG, JPEG, GIF and TIFF, but its
document-oriented interface is not a replacement for Gwenview's folder browsing,
thumbnails and image-editing tools. MuPDF is not installed by this setup.
HEIF/HEIC is not configured; KDE's HEIF support needs the optional `libheif` codec.

Deployment was smoke-checked by opening a generated PNG through `xdg-open` and
visually checking its rendering in Gwenview. MIME queries confirmed image
defaults and the unchanged PDF handler. Gitleaks found no secrets in the new
configuration. An existing Python `__pycache__` conflict required excluding
runtime bytecode during restow, without changing either copy:

```sh
stow --simulate --verbose --restow --ignore='__pycache__' E14
stow --restow --ignore='__pycache__' E14
```

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
- Hyprland Lua configuration, Hyprlock/Hypridle configuration and the Wofi launcher.
- The E14 systemd user-session target, compositor lifetime watcher and desktop-service units.
- Waybar, SwayNC and Wofi configuration/styles and the notification helper.
- The music-island and right-islands widget sources/styles/helpers and shared island palette.
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

## Desktop autostart

`hyprland.start` calls `~/.config/hypr/scripts/start-session.sh` once, then opens
the initial Kitty terminal as a normal application window. A configuration reload
does not rerun autostart. The background desktop has one owner: the systemd user
manager, grouped under `e14-session.target`.

The bootstrap waits up to five seconds for the first complete PID line in
`$XDG_RUNTIME_DIR/hypr/$HYPRLAND_INSTANCE_SIGNATURE/hyprland.lock`,
stops the old target, graphical session and lifetime watcher completely, and only
then imports the current display environment into D-Bus/systemd. Waiting for all
three stop jobs prevents old-session cleanup from erasing the new environment.
It sets the compositor PID and starts the target. `e14-session-watch.service`
uses util-linux `waitpid` to follow that process; when it exits, `BindsTo` stops
the target and propagates the stop to `graphical-session.target`. This also works
when the compositor exits without a Lua shutdown callback. The watcher cancels
pending lock-DPMS jobs and clears the session variables from the user manager.
This profile assumes one graphical session for this user.

| Component | systemd user unit |
| --- | --- |
| Notifications, idle lock, bar, polkit | Existing `swaync`, `hypridle`, `waybar`, `hyprpolkitagent` services |
| Desktop portals | Existing `xdg-desktop-portal` and `xdg-desktop-portal-hyprland` services |
| Clipboard history | `e14-clipboard@text.service`, `e14-clipboard@image.service` |
| Dictation and network tray | `e14-handy.service`, `e14-nm-applet.service` |
| Islands | `e14-music-island.service`, `e14-right-islands.service` |

The target pulls in these services; do not additionally enable them for boot or
launch them directly from Hyprland/XDG autostart. In particular, D-Bus notification
activation now reaches the same SwayNC unit instead of racing a directly started
daemon. Existing keyring and audio services keep their package-provided lifecycle.
Private application autostart/account configuration remains local and unchanged.
The installed SDDM session entry and UWSM selection are unchanged.

Deploy added files using the Stow procedure above, then load the new unit files:

```sh
systemctl --user daemon-reload
systemctl --user status e14-session.target
```

To start or rebuild the desktop stack in an existing unlocked session:

```sh
sh "$HOME/.config/hypr/scripts/start-session.sh"
```

This intentionally restarts the desktop services, not application windows; do not
run it during dictation or a portal screen-sharing session. For individual changes,
use `systemctl --user restart UNIT` and inspect `journalctl --user -u UNIT`.
`systemctl --user start e14-session.target` is a no-op while already active.

The Hyprland start hook sends bootstrap output and errors to the user
journal under `e14-session-start`; Hyprland otherwise discards spawned commands'
stdout/stderr. Inspect the automatic login attempt with:

```sh
journalctl --user -b -t e14-session-start --no-pager
```

The login trace exposed a startup race: `hyprland.start` can run before the current
instance's PID file is published. The previous `hyprctl -j instances` pipeline
then returned invalid JSON and aborted before starting any desktop services.
Waiting for the specific PID file removes both instance enumeration and its JSON
parser. A timeout aborts before stopping services or changing the manager environment.

`python3 tests/session-start.py` covers a delayed, incomplete PID line while another
instance exists, and a missing PID file without desktop side effects. Both checks
passed. The corrected bootstrap started the real target, watcher, Waybar and both
islands; a desktop capture confirmed bars on both monitors. Config reload and
Gitleaks passed. The temporary shell trace has been removed; errors remain journaled.
A fresh logout/login after this fix has not yet been exercised.

Verification exercised the actual bootstrap and services, repeated target starts
and Hyprland reloads without extra processes, and checked notification/portal/island
D-Bus ownership. A controlled watched-process exit stopped all 13 managed services,
the graphical target and stale manager environment; the real desktop was restored
without losing original application windows. Both monitors' bars/islands were
checked visually, and Hypridle retained its sleep-delay inhibitor. Unit validation
and Gitleaks passed. A real logout/login and compositor crash were not triggered.
The existing failed Dolphin unit from the earlier session disconnect was not reset.

## Application workspaces

`E14/.config/hypr/hyprland.lua` assigns newly opened windows by application class:

| Application | Class | Workspace |
| --- | --- | --- |
| Kitty terminal | `kitty` | 1 |
| Firefox | `firefox` | 2 |
| VS Code | `com.microsoft.VSCode` | 3 |
| OrcaSlicer | `orcaslicer` | 4 |
| Spotify | `Spotify` | 5 |

Opening a matching window switches to its destination workspace (no `silent`).
Application rules do not reassign existing windows to other workspaces on reload;
the monitor rules below can move whole workspaces. Autostart is unchanged.
Reload with `hyprctl reload`; no restow is needed for this existing file link.
Verified on the running compositor with temporary Kitty windows advertising each
class: all four landed on their assigned workspace and switched focus there.
The actual Firefox, VS Code and Spotify processes were not restarted.

### Monitor assignment and docking

The existing 1–10 keybinding loop also assigns those workspaces to monitors:

| Workspaces | Preferred output | Default workspace |
| --- | --- | --- |
| 1 | Internal `eDP-1` | 1 |
| 2–10 | External `DP-1` | 2 |

Selecting a workspace focuses its assigned output instead of bringing that
workspace onto the currently focused monitor. Without `DP-1`, all ten workspaces
remain usable on the internal screen. When the external output returns,
Hyprland moves the assigned workspaces back, including ones opened while undocked.
No persistent empty workspaces or additional docking daemon are introduced.
Application assignments, monitor modes/positions and the special scratchpad are
unchanged. Workspaces outside the configured 1–10 range have no monitor rule.
See [Hyprland workspace rules](https://wiki.hypr.land/Configuring/Basics/Workspace-Rules/).

Verification on the running compositor created workspaces 6–10 from the internal
screen and confirmed placement on `DP-1`. Temporarily disabling that output through
Hyprland moved existing workspaces to `eDP-1`; opening workspace 6 there also worked.
Restoring the configured outputs returned workspaces to their assigned monitors.
Original windows retained their workspace membership, previous active workspaces
were restored, configuration errors were empty and both outputs were checked
visually. Gitleaks found no secrets in the Hypr configuration directory.
Physical cable removal/reconnection was not tested.

## MX Master 3S workspace gestures

`logiops/logid.cfg` maps the thumb-rest gesture button (`0xc3`) to horizontal
workspace steps while held. Native `OnInterval` gestures emit `KEY_F13`/`KEY_F14`
repeatedly as the mouse moves, not on release or on a timer. Both directions use
`interval: 800`, calibrated with the physical mouse. With `threshold: 1`, the
first step occurs after approximately 801 movement units, then every 800.
Reversing direction requires moving back across the original button-down
position; it is not relative to the most recent turn.

The active Hyprland config binds XKB keycodes `191`/`192` (Linux F13/F14 plus 8),
because the default evdev keymap names these keys `XF86Tools`/`XF86Launch5`.
The callbacks select the nearest existing normal workspace by internal ID on
the focused monitor. Empty and named workspaces are eligible; special workspaces
and other monitors are excluded. At either end, nothing happens: no wrapping or
workspace creation. Touchpad gestures and Super+wheel bindings are unchanged.
Click-only, small and vertical gestures do nothing; other mouse controls are
not configured.

Install from the repository root after reviewing the AUR build recipe:

```sh
yay -S logiops
lua tests/mx-master-workspaces.lua
gitleaks dir --redact --no-banner logiops/logid.cfg
hyprland --verify-config --config "$HOME/.config/hypr/hyprland.lua"
```

Before deployment, inspect any existing `/etc/logid.cfg` and preserve unrelated
settings in a private backup. Merge only the gesture mapping if other devices
or settings are already configured. For a new installation:

```sh
sudo install -o root -g root -m 0644 logiops/logid.cfg /etc/logid.cfg
hyprctl reload config-only
hyprctl configerrors
sudo systemctl enable --now logid.service
systemctl is-active logid.service
sudo journalctl -u logid.service -b --no-pager -n 80
```

After subsequent config edits, copy again and use `sudo systemctl restart
logid.service`; the daemon has no reload action. `/etc/logid.cfg` must remain a
root-owned regular copy, never a symlink into this user-writable repository.
This top-level directory is not a Stow package; the E14 allowlist is unchanged.
Editing the already linked Hyprland file does not require restowing.

LogiOps 0.3.5 can detect the Bolt receiver but time out initializing the mouse
([upstream #446](https://github.com/PixlOne/logiops/issues/446)). This occurred
during setup: switching the mouse off/on with the daemon already running
produced `Device found: MX Master 3S`. If gestures stop after a service start,
check the journal for actual mouse detection, not merely an active service or
receiver detection. Do not run another Logitech controller alongside LogiOps.
Device identities and diagnostic logs remain outside the repository.

## Power-aware idle lock

Install `hypridle` (v0.1.8 or newer), `hyprlock` and systemd's `systemd-ac-power`.
`E14/.config/hypr/hypridle.conf` locks after 5 minutes on battery or 15 minutes
on AC, using the existing Hyprlock PAM/fingerprint configuration without a grace
period. It adds no automatic suspend or dimming.

Both listeners share the same inactivity cycle. After 5 idle minutes on AC,
Hypridle retries `! systemd-ac-power` every 5 seconds; unplugging can therefore
lock within roughly 5–10 seconds without restarting the timer. User activity
cancels pending retries. Power-query failures use the shorter timeout.
Standard Wayland, D-Bus and systemd idle inhibitors remain respected, including
OMP's active-session inhibitor.

Suspend requests are handled centrally by Hypridle:
`before_sleep_cmd = loginctl lock-session` uses the same grace-free lock command,
and `inhibit_sleep = 3` delays sleep until the Wayland session-lock notification.
This covers logind-mediated suspend from the power menu, `systemctl suspend`
and lid handling, provided Hypridle is running. It does not add automatic suspend.
The logind delay inhibitor is bounded by `InhibitDelayMaxSec` (currently 5 seconds);
it is not an indefinite fail-closed block if the locker fails.
See the [Hypridle sleep-inhibition documentation](https://wiki.hypr.land/Hypr-Ecosystem/hypridle/).

### Display power after locking

Hypridle's `on_lock_cmd` starts a transient user timer only after the compositor
confirms the session lock. After 10 seconds, `hyprlock-dpms.timer` runs
`hl.dsp.dpms({action = "off"})` for all outputs. Timer accuracy is 100 ms; normal
scheduler/IPC latency can add a little delay. This is a one-shot per lock event,
not another inactivity timeout, so idle inhibitors do not postpone it.

`on_unlock_cmd` stops any loaded `hyprlock-dpms.*` timer/service before turning
the displays on. Unlocking early therefore cancels the pending shutdown; locking
again starts a fresh delay. The timer/service are collected automatically and
remain runtime state outside Stow. The compositor signature is passed explicitly
to the transient service rather than relying on a stale user-manager environment.

`misc.key_press_enables_dpms` and `misc.mouse_move_enables_dpms` wake the displays
on keyboard or mouse input; waking does not itself unlock the session.
Authentication and the existing idle/suspend locking rules are unchanged.

Verification invoked the configured hooks without a real lock, as requested.
Canceling after 3 seconds and starting again kept both displays on past the old
deadline; both went DPMS-off about 10.23 seconds after the fresh start. Unlock
cleanup restored both outputs, worked after timer collection and left no transient
units. A Shift key woke both outputs through the native keyboard-wake option.
Automatic input wake was temporarily disabled only to observe the timed DPMS-off,
then restored. The latest hooks were activated by restarting the single Hypridle
instance; compositor config errors were empty and Gitleaks found no secrets.
Actual lock/unlock notifications, physical mouse wake and suspend/resume were not
exercised in this check.

`hypridle.service` is pulled in by `e14-session.target`; do not start a second
Hypridle process directly. After editing its linked configuration, activate it with:

```sh
systemctl --user restart hypridle.service
```

No restow or Hyprland restart is needed for existing linked files. Check that
exactly one Hypridle instance is running and that `systemd-inhibit --list` lists
its `sleep` / `delay` inhibitor.

Short-timeout verification used real Hypridle/Hyprlock and real AC detection.
Battery, unplug and retry-cancellation scenarios used only a temporary
power-source simulator, not a physical unplug. Repeated lock requests kept one
Hyprlock process; the user confirmed the existing Power-menu Lock action and
manual unlocking. Test scripts, screenshots and logs stay outside the repository.
Production-duration timing and automatic startup on the next login are separate
checks; do not log out with unsaved work just to test them.

The suspend-lock configuration was activated in the existing session: one
Hypridle instance was running and logind reported its sleep-delay inhibitor,
which was absent with the previous `inhibit_sleep = 0` configuration. Gitleaks
found no secrets in the Hypr configuration directory. No actual lock, suspend,
lid-close or resume was triggered; the hardware round trip remains unverified.

## SDDM: E14 Glass

`sddm/e14-glass/` is a standalone Qt6 login theme with a solid dark background,
small field labels, compact centered login controls and bottom power actions.
It is **not** a Stow package: the pre-login greeter must load root-owned copies,
never symlinks into a user's writable home. E14, `.gitignore`, PAM, fingerprint,
autologin, the display server and session startup remain unchanged.
There is no wallpaper or profile image. Small session and keyboard selectors sit
in the bottom-right corner; no home-directory assets are loaded.
Usernames remain editable, and SDDM's native session/keyboard models are retained.
The clock is real; battery/network indicators and unsupported sleep actions are
not imitated.

From the repository root, check the two isolated form regressions and preview:

```sh
QT_QPA_PLATFORM=offscreen QT_QUICK_BACKEND=software \
  /usr/lib/qt6/bin/qmltestrunner -input sddm/tests
sddm-greeter-qt6 --test-mode --theme "$PWD/sddm/e14-glass"
gitleaks dir --redact --no-banner sddm
```

Test mode has no authentication daemon. Use only synthetic passwords; do not
invoke power actions. It cannot verify a real login, PAM or keyring integration.
Check both desktop monitor sizes and scrolling/focus at 640×480 before installing.
Required runtime modules are Qt6 Quick, Layouts and Controls.Basic; tests use
QtTest/QuickTest. No virtual-keyboard module, special font or runtime blur addon
is required.

Before installing, inspect `/usr/lib/sddm/sddm.conf.d/`, `/etc/sddm.conf.d/` and
`/etc/sddm.conf` (in that precedence order, last wins). Back up any replaced files
under `/var/backups/sddm-e14-glass/<timestamp>/`, retaining their relative paths
and a 0700 backup root. Resolve competing `[Theme]` `Current`/`ThemeDir` entries
without changing other settings. Preserve unknown files in an existing theme
directory; install only these three files:

```sh
sudo install -d -m 0755 /usr/local/share/sddm/themes/e14-glass /etc/sddm.conf.d
sudo install -o root -g root -m 0644 \
  sddm/e14-glass/Main.qml sddm/e14-glass/metadata.desktop \
  sddm/e14-glass/theme.conf /usr/local/share/sddm/themes/e14-glass/
sudo install -o root -g root -m 0644 \
  sddm/e14-glass.conf /etc/sddm.conf.d/e14-glass.conf
```

Verify root:root/0644, non-writable directories, matching source/destination
hashes and readability of each theme file with `sudo -u sddm test -r <file>`.
Preview `/usr/local/share/sddm/themes/e14-glass` using the same greeter command,
and check the effective theme directives, not `sddm --example-config`.
Do **not** restart SDDM: selection applies when the greeter next appears normally.

To roll back, remove only the newly introduced
`/etc/sddm.conf.d/e14-glass.conf`, or restore its backed-up predecessor and any
competing theme directives changed during installation. The inactive root-owned
theme may remain. No Stow operation is involved.

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

The island units use `Type=dbus`: music-island is ready only after it owns
`io.Astal.music-island`, and right-islands has `Requires`/`After` dependencies on it.
Both start after Waybar. AGS 3.1 writes every `ags run` bundle to the same
`$XDG_RUNTIME_DIR/ags.js`; concurrent starts can therefore load the wrong widget.
Keep this ordering and use the units rather than launching additional AGS copies.
GTK box spacing belongs in the TSX `spacing` property, not in GTK CSS.

The center music and clock compact surfaces have a 44px outer height, matching
Waybar and right-islands at a 9px top offset. The player anchors below the measured
music header, so reducing the header does not change its width, content or animation.
Live `hyprctl layers` checks confirmed 44px compact layers on eDP-1 and DP-1;
screenshots confirmed unclipped music/clock labels and the joined hover player.

Both island launches set
`GDK_WAYLAND_DISABLE=ext_background_effect_manager_v1` for that process only.
GTK 4.24.1 creates a background-effect object even without a requested blur region;
Hyprland 0.56.2 gives this empty client region precedence over its layer blur rules.
Disabling that protocol lets the existing `music-island` and `right-islands`
layer rules blur the translucent pixels, including the Cairo-drawn stats/control
cards and their animated contours. CSS opacity and the GTK renderer stay unchanged;
other GTK applications are unaffected. The override is set in both island units;
restart those units to apply widget changes. A Hyprland reload does not restart them.
See [GTK's surface setup](https://github.com/GNOME/gtk/blob/4.24.1/gdk/wayland/gdksurface-wayland.c)
and [Hyprland's `shouldBlur` precedence](https://github.com/hyprwm/Hyprland/blob/v0.56.2/src/render/Renderer.cpp).
Verification: both real island processes ran with the scoped override, neither
bound the background-effect protocol, and music, stats and control hover cards
were opened and visually checked over application content. No GTK warnings/errors
were observed; Hyprland config verification and Gitleaks scanning passed.

The migration exercised real Stow deploy/restow/unstow and conflict handling in
an isolated target, verified all 21 live file links and preserved script modes,
checked Bash/Lua/Python/JSON syntax, parsed the deployed configuration with
`hyprland --verify-config`, and loaded the deployed `.bashrc` in interactive Bash.
The hook was checked with clean data, a synthetic staged token and a missing
scanner. No compositor reload, lock/authentication attempt or application
restart was needed for the file-link migration.

### Shared island background

Change **only `@define-color island_bg`** in
`E14/.config/island-shared/style.css` (also linked at
`~/.config/island-shared/style.css`) to set the surface color and opacity:

```css
@define-color island_bg rgba(20, 25, 40, 0.45);
```

Waybar (including its tooltips), the music/clock islands, the right-hand compact
islands and all three hover cards use this named color. Each stylesheet imports
the shared file. AGS loads its stylesheet by path so GTK resolves relative imports;
the Cairo stats/control contours read the same color with `lookup_color`.
Borders, animation geometry and internal button/meter highlights remain separate.
The `waybar`, `music-island` and `right-islands` layer rules use `xray = true`
in `E14/.config/hypr/hyprland.lua`. All compact/expanded surfaces sample the
blurred wallpaper rather than application windows, preventing a bright window
from producing a different tint below a dark compact header. Wallpaper colors
can still show through; use alpha `1` in `island_bg` for a completely flat color.
This is scoped to these three namespaces, not a global change to window blur.
After changing only these compositor rules, `hyprctl reload config-only` is enough.
Verification opened music, stats and controls over a running browser: the browser
toolbar/content no longer tinted the panels. Config verification and Gitleaks passed.

After editing the palette, reload Waybar first:

```sh
systemctl --user reload waybar.service
```

Wait for Waybar to reappear, then restart both islands in one ordered transaction:

```sh
systemctl --user restart e14-music-island.service e14-right-islands.service
```

Restarting the islands after Waybar also puts their hover targets above Waybar's
full-width layer. Their units preserve the scoped protocol override and D-Bus
startup ordering. No restow is needed for subsequent palette edits.

Verification loaded all three deployed stylesheets with their actual GTK3/GTK4
parsers and checked the resolved RGBA values, then reloaded Waybar and sequentially
started both real AGS applications. Desktop captures showed the expanded music,
stats and control surfaces, including the rounded Cairo necks; both application
logs were empty. The new palette passed Gitleaks and manual personal-data review.
Stow simulation/restow used `--ignore='__pycache__'` for the existing local bytecode
conflict; caches, logs and desktop captures remain outside the repository.

### Center-out hover lighting

Waybar workspace buttons, Wofi entries, power-menu tiles/confirmation buttons,
right-islands tiles, music player controls and notification-center action buttons
use a soft radial highlight that grows from the element's center over 420ms.
The same transition retracts on pointer exit and reverses from its current
state on re-entry. Only the background changes; labels, hit targets and layout
stay fixed. Active-workspace, urgent, keyboard-focus and pressed fills remain
separate from the hover light.

The SDDM source uses a centered, expanding rounded highlight with the same
duration. This approximates the spreading illumination and fluid motion in
Apple's [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/),
not its real-time refraction. Apple's
[Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)
also recommends reserving the material for controls and preserving legibility.

Verification loaded all six stylesheets in their GTK3/GTK4 parsers, exercised
the real power-menu widgets in an isolated Broadway display, and rendered a
GTK4 tile with hover/exit. An isolated Qt smoke exercised centered growth,
exit/re-entry, stable button geometry and disabling during authentication;
the existing greeter regressions also passed. No power/authentication action
was invoked. Waybar/SwayNC styles were reloaded and both AGS islands restarted
in sequence; a desktop capture confirmed the islands on both monitors.
Existing Stow file links remain unchanged. The root-owned SDDM installation
was not updated because noninteractive sudo required a password; use the
backup/install procedure above before expecting this effect at login.

### Native island dropdown motion

The existing music, statistics and controls dropdowns use the shared
`E14/.config/island-shared/fluid-reveal.ts` GTK4 widget. Each entire card grows
downward from the bottom centre of its own permanent summary and retracts to
that same point, not the centre of the wider dropdown. The clock and permanent
row do not participate in that
layout; workspace/button hover lighting and the existing card materials remain
unchanged. Statistics and controls keep independent contours while switching.

The module uses libadwaita's critically damped spring `(1, 1, 500)`, with a
160ms leave delay in the callers and continuous velocity on reversal. These
are local tuning values, not Apple's parameters or an exact 420ms duration.
Full-size child allocation plus a GSK transform avoids per-frame reflow.
The surface input region follows the displayed card instead of intercepting
the invisible remainder. GTK's disabled-animation preference is respected.
Media disappearance closes the player immediately; returning media alone does
not reopen it.

The compact header's joined contour follows visible spring progress, not popup
mapping: its bottom border and rounded corners stay intact until 90% expansion,
and return as soon as shrinking passes below that point. Reentry follows the
same threshold without a separate timer. Immediate closure and disposal restore
the compact contour immediately.

Run the real-widget regression on an available GTK display:

```sh
ags bundle tests/island-fluid-reveal.ts /tmp/island-fluid-reveal-test.js
ags bundle E14/.config/music-island/app.tsx /tmp/music-island-fluid-smoke.js
ags bundle E14/.config/right-islands/app.tsx /tmp/right-islands-fluid-smoke.js
GSK_RENDERER=cairo bash /tmp/island-fluid-reveal-test.js
```

AGS 3.1 bundles are shell launchers despite the `.js` output name; do not pass
them directly to `gjs -m`. Alternatively execute `tests/island-fluid-reveal.ts`
directly. Verification passed on native Wayland and isolated Xvfb (`DISPLAY=:98`,
`GDK_BACKEND=x11`): intermediate/off-centre bounds, full-size layout, GTK picking,
stable header dimensions, opening/closing reversals, delayed hiding, disabled
animations, immediate closure and disposal during motion/driver destruction.
The fixed top-right attachment during opening and closing also passed the
real-widget regression on native Wayland.
Contour-timing checks use both actual island stylesheets on mapped GTK headers:
the bottom border remains during early growth, disappears at full expansion,
and returns while the shrinking popup is still visible. Reentry, disabled
animations, immediate closure and disposal also preserve the correct contour.
Broadway was attempted with a connected browser but produced JavaScript errors
and stalled/incorrect frame timings; it was not accepted as animation proof.

The shared source passed Gitleaks and manual personal-data review and was
deployed as an individual Stow link. Restow required `--ignore='__pycache__'`
because an existing unrelated Python cache conflicted; neither cache was
overwritten. Existing source links were preserved. Both deployed applications
were restarted sequentially and registered successfully. Desktop capture is
unavailable (`Wayland capture requires the wayland-pipewire feature`), so
multi-monitor visual hover/contour checks, compositor-level input passthrough
and the live media-loss producer scenario remain unverified. No media, audio,
network, Bluetooth or power action was invoked. Test display services and
temporary tools are not managed configuration.

### Native power menu

`Super+P` runs `~/.config/hypr/scripts/power-menu.sh`; pseudo-tiling moves to
`Super+Shift+P`. `Super+R` keeps the existing Wofi application launcher and style.
The power menu's `power-menu.py` is a short-lived GTK3 surface, not a service.
It requires Python 3/PyGObject, GTK3 and the GtkLayerShell 0.1 introspection API.
Its stylesheet remains at `wofi/powermenu.css`; the app launcher does not load it.

Five equal 146×166 logical-pixel tiles form a compact, centered horizontal group
with 16px gaps, 48px icons above 17px labels and no enclosing frame. Arrow keys,
Home/End and Tab move focus; Enter/Space activate it and Escape cancels.
Entering a tile or moving the pointer within it also moves keyboard focus there,
including in confirmation dialogs. Arrow-key navigation continues from that
tile; a stationary pointer does not override keyboard navigation. Leaving a
tile keeps its selection. Hover alone never activates an action.
Keyboard focus triggers the same 420ms center-out highlight as hover, including
on confirmation buttons; the focus border remains visible.
To compensate font sidebearings, all icons except Sleep have a 5px optical
left shift; captions and tile geometry remain centered and unchanged.
The `power-menu` layer namespace shares the `launcher-glass` blur rule with Wofi.
An overlay-layer surface anchored to every edge with exclusive zone -1 covers
the focused output, including Waybar, without changing panel reservations.
`hyprctl monitors -j` selects the focused output; no offset compensation is needed.
Confirmations use a compact centered button group over the same full-screen glass.

Lock runs `hyprlock --grace 0`. Sleep runs `systemctl suspend`; the running
Hypridle instance requests locking and delays suspend as described under
Power-aware idle lock. Hibernate is not offered or dispatched.
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
Hover-focus verification used the actual widgets on an isolated Broadway
display: tile entry selected Sleep, Right selected Shutdown, pointer movement
within Sleep selected it again, and leaving preserved that selection. Space
then emitted Sleep. Hovering the confirmation button followed by Enter emitted
`Bestätigen`. These previews ran the GTK class directly, without the shell
dispatcher, so no actual power command ran.
Keyboard-only Arrow/Tab navigation also rendered the radial highlight on tiles
and confirmation buttons, verified visually and with intermediate pixel samples.
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

### 1Password fingerprint unlock

1Password for Linux uses Polkit for system authentication. An enrolled
fingerprint and working SDDM/Hyprlock unlock do not enable it for Polkit:
Arch's vendor `/usr/lib/pam.d/polkit-1` includes `system-auth`, which on this
machine authenticates by password only.

The host-local override `/etc/pam.d/polkit-1` contains:

```pam
#%PAM-1.0

# Try the enrolled fingerprint, then fall back to the system password.
auth       sufficient   pam_fprintd.so max-tries=3 timeout=15
auth       include      system-auth
account    include      system-auth
password   include      system-auth
session    include      system-auth
```

Keep this file root-owned, mode `0644`, outside Stow. It applies to all Polkit
authentication, not just 1Password; `system-auth`, SDDM, Hyprlock and sudo remain
unchanged. Fingerprint authentication for privileged actions carries the
[fingerprint-hijacking risk documented by Arch](https://wiki.archlinux.org/title/Fprint#Login_configuration).
The password fallback starts after fingerprint failure or the 15-second timeout.
Removing this local override restores the vendor PAM configuration.

In 1Password, enable **Settings > Security > Unlock using system authentication**.
After starting/restarting 1Password, unlock once with the account password
before using the fingerprint icon on subsequent unlocks; see
[1Password's system-authentication guide](https://support.1password.com/system-authentication-linux/).
No 1Password profile, vault data or biometric enrollment belongs in this repository.

Verification: an interactive `pkcheck` for
`com.1password.1Password.unlock` completed successfully after installing the
override. Unlocking a real vault and the password fallback were not exercised.

### Local dictation with Handy

Install `handy-bin` from the AUR and Arch's `wtype` package. The current
installation uses Handy 0.9.8; its reviewed AUR recipe repackages the upstream
release and verifies the downloaded sources with BLAKE2 checksums.
Updates belong to the package manager, not Handy's built-in updater.

`e14-handy.service` starts `handy --start-hidden` once per compositor session:

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
| Startup | Start hidden; Handy's own login autostart off (`e14-handy.service` owns it) |
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

