#!/usr/bin/python3

import argparse
import json
from pathlib import Path
import subprocess

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
gi.require_version("GtkLayerShell", "0.1")
from gi.repository import Gdk, Gtk, GtkLayerShell


ACTIONS = (
    ("", "Lock"),
    ("", "Logout"),
    ("", "Sleep"),
    ("", "Shutdown"),
    ("", "Reboot"),
)


class PowerMenu(Gtk.Window):
    def __init__(self, monitor, confirmation=None):
        super().__init__(title="Power-Menü")
        self.set_name("power-menu")
        self.set_visual(self.get_screen().get_rgba_visual())
        self.set_decorated(False)
        self.connect("destroy", lambda *_: Gtk.main_quit())
        self.connect("key-press-event", self.on_key_press)

        GtkLayerShell.init_for_window(self)
        GtkLayerShell.set_namespace(self, "power-menu")
        GtkLayerShell.set_layer(self, GtkLayerShell.Layer.OVERLAY)
        GtkLayerShell.set_monitor(self, monitor)
        GtkLayerShell.set_keyboard_mode(self, GtkLayerShell.KeyboardMode.EXCLUSIVE)
        # Cover panel reservations without reserving any desktop space ourselves.
        GtkLayerShell.set_exclusive_zone(self, -1)
        for edge in (GtkLayerShell.Edge.TOP, GtkLayerShell.Edge.BOTTOM,
                     GtkLayerShell.Edge.LEFT, GtkLayerShell.Edge.RIGHT):
            GtkLayerShell.set_anchor(self, edge, True)

        content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=24)
        content.set_halign(Gtk.Align.CENTER)
        content.set_valign(Gtk.Align.CENTER)
        self.add(content)
        self.buttons = []

        if confirmation:
            heading = Gtk.Label(label=f"{confirmation} bestätigen?")
            heading.get_style_context().add_class("confirmation-heading")
            content.pack_start(heading, False, False, 0)

        row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=16)
        row.set_homogeneous(True)
        content.pack_start(row, False, False, 0)

        if confirmation:
            for label in ("Abbrechen", "Bestätigen"):
                button = Gtk.Button(label=label)
                button.get_style_context().add_class("confirmation-button")
                button.connect("clicked", self.finish, label)
                row.pack_start(button, False, False, 0)
                self.buttons.append(button)
        else:
            for icon, label in ACTIONS:
                button = Gtk.Button()
                button.get_style_context().add_class("power-tile")
                button.get_accessible().set_name(label)
                stack = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=16)
                stack.set_halign(Gtk.Align.CENTER)
                stack.set_valign(Gtk.Align.CENTER)
                symbol = Gtk.Label(label=icon)
                symbol.get_style_context().add_class("power-icon")
                if label != "Sleep":
                    symbol.get_style_context().add_class("optical-left")
                caption = Gtk.Label(label=label)
                caption.get_style_context().add_class("power-label")
                stack.pack_start(symbol, False, False, 0)
                stack.pack_start(caption, False, False, 0)
                button.add(stack)
                button.connect("clicked", self.finish, f"{icon}  {label}")
                row.pack_start(button, False, False, 0)
                self.buttons.append(button)

        for button in self.buttons:
            button.add_events(Gdk.EventMask.POINTER_MOTION_MASK)
            for signal in ("enter-notify-event", "motion-notify-event"):
                button.connect(signal, lambda button, _event: button.grab_focus())

    def finish(self, _button, answer):
        print(answer, flush=True)
        self.destroy()

    def on_key_press(self, _window, event):
        if event.keyval == Gdk.KEY_Escape:
            self.destroy()
            return True
        if event.keyval in (Gdk.KEY_Left, Gdk.KEY_Right, Gdk.KEY_Home, Gdk.KEY_End):
            index = next((i for i, button in enumerate(self.buttons)
                          if button.has_focus()), 0)
            if event.keyval == Gdk.KEY_Home:
                index = 0
            elif event.keyval == Gdk.KEY_End:
                index = len(self.buttons) - 1
            else:
                index = (index + (1 if event.keyval == Gdk.KEY_Right else -1)) % len(self.buttons)
            self.buttons[index].grab_focus()
            return True
        return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--confirm", choices=("Logout", "Shutdown", "Reboot"))
    args = parser.parse_args()

    monitors = json.loads(subprocess.check_output(["hyprctl", "monitors", "-j"], text=True))
    focused = next(monitor for monitor in monitors if monitor["focused"])
    display = Gdk.Display.get_default()
    monitor = display.get_monitor_at_point(focused["x"] + 1, focused["y"] + 1)

    provider = Gtk.CssProvider()
    provider.load_from_path(str(Path.home() / ".config/wofi/powermenu.css"))
    Gtk.StyleContext.add_provider_for_screen(
        Gdk.Screen.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
    )
    window = PowerMenu(monitor, args.confirm)
    window.show_all()
    window.buttons[0].grab_focus()
    Gtk.main()


if __name__ == "__main__":
    main()
