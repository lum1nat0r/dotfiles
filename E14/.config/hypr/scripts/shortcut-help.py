#!/usr/bin/python3

import fcntl
import json
import os
from pathlib import Path
import subprocess

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
gi.require_version("GtkLayerShell", "0.1")
from gi.repository import Gdk, Gtk, GtkLayerShell


KEY_NAMES = {
    "RETURN": "Enter", "SPACE": "Leertaste", "TAB": "Tab",
    "LEFT": "←", "RIGHT": "→", "UP": "↑", "DOWN": "↓",
    "PRINT": "Druck", "GRAVE": "`", "ALT_L": "Alt links", "ALT_R": "Alt rechts",
    "SHIFT_L": "Shift links", "SHIFT_R": "Shift rechts",
    "MOUSE_DOWN": "Mausrad ↓", "MOUSE_UP": "Mausrad ↑",
    "MOUSE:272": "Linksklick + Ziehen", "MOUSE:273": "Rechtsklick + Ziehen",
    "XF86AUDIORAISEVOLUME": "Lauter", "XF86AUDIOLOWERVOLUME": "Leiser",
    "XF86AUDIOMUTE": "Audio-Mute", "XF86AUDIOMICMUTE": "Mikrofon-Mute",
    "XF86MONBRIGHTNESSUP": "Helligkeit +", "XF86MONBRIGHTNESSDOWN": "Helligkeit −",
    "XF86AUDIONEXT": "Nächster Titel", "XF86AUDIOPREV": "Vorheriger Titel",
    "XF86AUDIOPLAY": "Play", "XF86AUDIOPAUSE": "Pause",
}
MODIFIERS = ((64, "Super"), (4, "Ctrl"), (8, "Alt"), (1, "Shift"),
             (2, "Caps"), (16, "Mod2"), (32, "Mod3"), (128, "Mod5"))


def shortcut_rows(bindings):
    groups = {}
    for binding in bindings:
        description = binding["description"]
        category, separator, action = description.partition(": ")
        if not separator:
            category, action = "Weitere", description or binding["dispatcher"]
            if description.startswith("Open Switch"):
                category = "Fensterwechsel"
                action = "Fensterwechsel rückwärts" if "reverse" in description else "Fensterwechsel vorwärts"
            elif description.startswith("Close Switch"):
                category, action = "Fensterwechsel", "Ausgewähltes Fenster übernehmen"
        if binding["submap"]:
            action = f"[{binding['submap']}] {action}"
        mask = binding["modmask"]
        key = binding["key"].upper()
        if binding["release"]:
            action += " · loslassen"
            if key in ("ALT_L", "ALT_R"):
                mask &= ~8
            elif key in ("SHIFT_L", "SHIFT_R"):
                mask &= ~1
        elif binding["repeat"]:
            action += " · halten"
        # shortcut: Hyprland 0.56 omits Lua keycodes in binds IPC; drop explicit labels when IPC exposes them.
        if not key and " → " in action:
            key, action = action.split(" → ", 1)
        elif binding["keycode"]:
            key = f"Keycode {binding['keycode']}"
        else:
            key = KEY_NAMES.get(key, key)
        groups.setdefault((category, action, mask), []).append(key)

    rows = []
    for (category, action, mask), keys in groups.items():
        keys = list(dict.fromkeys(keys))
        if set(keys) == set("0123456789"):
            keys = ["1–9 / 0"]
        combo = " + ".join([name for bit, name in MODIFIERS if mask & bit] + [" / ".join(keys)])
        rows.append((category, combo, action))
    return rows


class ShortcutHelp(Gtk.Window):
    def __init__(self, monitor, rows):
        super().__init__(title="Hyprland · Cheat-Sheet")
        self.set_name("shortcut-help")
        self.set_visual(self.get_screen().get_rgba_visual())
        self.set_decorated(False)
        self.connect("destroy", lambda *_: Gtk.main_quit())
        self.connect("key-press-event", self.on_key_press)
        GtkLayerShell.init_for_window(self)
        GtkLayerShell.set_namespace(self, "shortcut-help")
        GtkLayerShell.set_layer(self, GtkLayerShell.Layer.OVERLAY)
        GtkLayerShell.set_monitor(self, monitor)
        GtkLayerShell.set_keyboard_mode(self, GtkLayerShell.KeyboardMode.EXCLUSIVE)
        GtkLayerShell.set_exclusive_zone(self, -1)
        for edge in (GtkLayerShell.Edge.TOP, GtkLayerShell.Edge.BOTTOM,
                     GtkLayerShell.Edge.LEFT, GtkLayerShell.Edge.RIGHT):
            GtkLayerShell.set_anchor(self, edge, True)

        geometry = monitor.get_geometry()
        panel = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=16)
        panel.get_style_context().add_class("help-panel")
        panel.set_halign(Gtk.Align.CENTER)
        panel.set_valign(Gtk.Align.CENTER)
        panel.set_size_request(min(1640, geometry.width - 96), -1)
        self.add(panel)
        header = Gtk.Box(spacing=24)
        title = Gtk.Label(label="Hyprland · Cheat-Sheet", xalign=0)
        title.get_style_context().add_class("help-title")
        header.pack_start(title, True, True, 0)
        close = Gtk.Button(label="Schließen · Esc")
        close.connect("clicked", lambda *_: self.destroy())
        header.pack_end(close, False, False, 0)
        panel.pack_start(header, False, False, 0)
        self.search = Gtk.SearchEntry(placeholder_text="Shortcuts suchen … z. B. Screenshot, Terminal oder Super + F")
        self.search.connect("search-changed", self.filter_rows)
        panel.pack_start(self.search, False, False, 0)

        scroll = Gtk.ScrolledWindow()
        scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scroll.set_overlay_scrolling(False)
        scroll.set_min_content_height(min(1000, max(240, geometry.height - 300)))
        panel.pack_start(scroll, True, True, 0)
        columns = Gtk.Box(spacing=28, homogeneous=True)
        scroll.add(columns)
        stacks = [Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=18) for _ in range(3)]
        for stack in stacks:
            stack.set_valign(Gtk.Align.START)
            columns.pack_start(stack, True, True, 0)
        sections = {}
        for category, combo, action in rows:
            sections.setdefault(category, []).append((combo, action))
        self.sections = []
        heights = [0, 0, 0]
        for category, entries in sections.items():
            index = min(range(3), key=heights.__getitem__)
            heights[index] += len(entries) + 2
            section = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
            heading = Gtk.Label(label=category, xalign=0)
            heading.get_style_context().add_class("help-heading")
            section.pack_start(heading, False, False, 0)
            widgets = []
            for combo, action in entries:
                row = Gtk.Box(spacing=12)
                row.get_style_context().add_class("shortcut-row")
                key = Gtk.Label(label=combo, xalign=0, yalign=0.5)
                key.set_line_wrap(True)
                key.set_width_chars(19)
                key.set_max_width_chars(23)
                key.get_style_context().add_class("shortcut-key")
                label = Gtk.Label(label=action, xalign=0, yalign=0.5)
                label.set_line_wrap(True)
                label.set_max_width_chars(28)
                row.pack_start(key, False, False, 0)
                row.pack_start(label, True, True, 0)
                section.pack_start(row, False, False, 0)
                widgets.append((row, f"{category} {combo} {action}".casefold()))
            stacks[index].pack_start(section, False, False, 0)
            self.sections.append((section, widgets))
        self.empty = Gtk.Label(label="Keine passenden Shortcuts.")
        self.empty.set_no_show_all(True)
        panel.pack_start(self.empty, False, False, 0)
        footer = Gtk.Label(label="Super = Windows-Taste · Halten = Wiederholung · 3 Finger horizontal = Workspace wechseln\nAlt-Tab: Alt halten, mit Tab wählen, Alt loslassen bestätigen · Enter bestätigen / Esc abbrechen", xalign=0)
        footer.get_style_context().add_class("help-footer")
        footer.set_line_wrap(True)
        panel.pack_start(footer, False, False, 0)

    def filter_rows(self, entry):
        words = entry.get_text().casefold().replace("+", " ").split()
        any_match = False
        for section, widgets in self.sections:
            section_match = False
            for row, text in widgets:
                visible = all(word in text for word in words)
                row.set_visible(visible)
                section_match |= visible
            section.set_visible(section_match)
            any_match |= section_match
        self.empty.set_visible(not any_match)

    def on_key_press(self, _window, event):
        if event.keyval == Gdk.KEY_Escape:
            self.destroy()
            return True
        return False


def main():
    # Keep the lock open until the overlay closes; repeated shortcuts do not stack windows.
    with (Path(os.environ["XDG_RUNTIME_DIR"]) / "e14-shortcut-help.lock").open("w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        bindings = json.loads(subprocess.check_output(["hyprctl", "-j", "binds"], text=True))
        monitors = json.loads(subprocess.check_output(["hyprctl", "-j", "monitors"], text=True))
        focused = next(monitor for monitor in monitors if monitor["focused"])
        display = Gdk.Display.get_default()
        monitor = display.get_monitor_at_point(focused["x"] + 1, focused["y"] + 1)
        provider = Gtk.CssProvider()
        provider.load_from_path(str(Path.home() / ".config/wofi/shortcut-help.css"))
        Gtk.StyleContext.add_provider_for_screen(
            Gdk.Screen.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        )
        window = ShortcutHelp(monitor, shortcut_rows(bindings))
        window.show_all()
        window.search.grab_focus()
        Gtk.main()


if __name__ == "__main__":
    main()
