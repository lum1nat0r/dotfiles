import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createPoll } from "ags/time"
import { createState, createEffect, createBinding, For, onCleanup } from "ags"
import GLib from "gi://GLib"
import css from "./style.css"
import { createFluidReveal } from "../island-shared/fluid-reveal"

const empty = { visible: false, playing: false, title: "", artist: "", cover: "", duration: 0, position: 0 }
const script = `${GLib.get_home_dir()}/.config/music-island/metadata.py`
// The summary and lower player share one width; hovering never changes the centred row.
const musicWidth = 300

function CenterIslands({ monitor }: { monitor: Gdk.Monitor }) {
  const state = createPoll(JSON.stringify(empty), 1500, `python ${script}`)
  const data = state((s: string) => {
    try { return { ...empty, ...JSON.parse(s) } } catch { return empty }
  })
  const time = createPoll("--:--", 1000, "date +%H:%M")
  const weekday = createPoll("", 30000, "date +%A")
  const date = createPoll("", 30000, "date '+%d. %B'")
  const [playerJoined, setPlayerJoined] = createState(false)
  const clockOnlyVisible = data(d => !d.visible)
  const compactVisible = data(d => d.visible)
  let closeTimer = 0
  let playerReveal: {
    setOpen(open: boolean): void
    closeImmediately(): void
    dispose(): void
  } | undefined
  const cancelClose = () => {
    if (closeTimer) GLib.source_remove(closeTimer)
    closeTimer = 0
  }
  const scheduleClose = () => {
    cancelClose()
    closeTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 160, () => {
      closeTimer = 0
      playerReveal?.setOpen(false)
      return GLib.SOURCE_REMOVE
    })
  }
  onCleanup(() => {
    cancelClose()
    playerReveal?.dispose()
  })
  let summary: Gtk.Box
  let musicSummary: Gtk.Box
  let playerWindow: Astal.Window
  const openPlayer = () => {
    cancelClose()
    // The permanent row alone determines the anchor; the player never recentres the clock.
    playerWindow.margin_left = Math.round((monitor.get_geometry().width - summary.get_width()) / 2)
    playerWindow.margin_top = 9 + musicSummary.get_height()
    playerReveal?.setOpen(true)
  }
  createEffect(() => {
    if (!data().visible) {
      cancelClose()
      playerReveal?.closeImmediately()
    }
  })
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
  const control = (command: string) => {
    try { GLib.spawn_command_line_async(`playerctl -p spotify ${command}`) } catch (e) { console.error(e) }
  }
  const clock = (
    <box class="clock-shell" spacing={12} valign={Gtk.Align.START}>
      <label label={time} class="clock-time" />
      <box class="clock-divider" />
      <box orientation={Gtk.Orientation.VERTICAL} spacing={1} valign={Gtk.Align.CENTER} class="clock-details">
        <label label={weekday} class="clock-weekday" xalign={0} />
        <label label={date} class="clock-date" xalign={0} />
      </box>
    </box>
  )
  const header = (
    <box class="music-compact" spacing={10}>
      <label label="󰓇" class="spotify-icon" />
      <label label={data(d => d.title)} ellipsize={3} maxWidthChars={24} hexpand class="compact-title" />
      <label label={data(d => d.playing ? "󰏤" : "󰐊")} class="compact-control" />
    </box>
  )
  const playerCard = (
          <box widthRequest={musicWidth} orientation={Gtk.Orientation.VERTICAL} class="music-shell player-shell">
            <Gtk.EventControllerMotion onEnter={openPlayer} onLeave={scheduleClose} />
            <box orientation={Gtk.Orientation.VERTICAL} class="player" spacing={9}>
              <image file={data(d => d.cover || "/nonexistent/music-island-cover")} pixelSize={220} class="album-art" />
              <label label={data(d => d.title)} ellipsize={3} maxWidthChars={24} class="track-title" />
              <label label={data(d => d.artist)} ellipsize={3} maxWidthChars={24} class="track-artist" />
              <levelbar value={data(d => d.duration ? Math.min(1, d.position / d.duration) : 0)} class="progress" />
              <box class="times">
                <label label={data(d => fmt(d.position))} hexpand />
                <label label={data(d => fmt(d.duration))} />
              </box>
              <box class="player-controls" halign={Gtk.Align.CENTER} spacing={22}>
                <button label="󰒮" onClicked={() => control("previous")} />
                <button label={data(d => d.playing ? "󰏤" : "󰐊")} onClicked={() => control("play-pause")} class="primary" />
                <button label="󰒭" onClicked={() => control("next")} />
              </box>
            </box>
          </box>
  ) as Gtk.Widget
  const common = {
    gdkmonitor: monitor,
    anchor: Astal.WindowAnchor.TOP,
    exclusivity: Astal.Exclusivity.IGNORE,
    marginTop: 9,
    application: app,
    namespace: "music-island",
    class: "music-window",
  }
  return (
    <>
      <window {...common} name="center-islands-clock-only" visible={clockOnlyVisible}>
        <box class="center-row">{clock}</box>
      </window>
      <window {...common} name="center-islands-compact" visible={compactVisible}>
        <box class="center-row" spacing={12} $={self => { summary = self }}>
          <box valign={Gtk.Align.START} $={self => { musicSummary = self }}>
          <box widthRequest={musicWidth}
            class={playerJoined(joined => `music-shell${joined ? " joined" : ""}`)}>
            <Gtk.EventControllerMotion onEnter={openPlayer} onLeave={scheduleClose} />
            {header}
          </box>
          </box>
          <box class="clock-shell" spacing={12} valign={Gtk.Align.START}>
            <label label={time} class="clock-time" />
            <box class="clock-divider" />
            <box orientation={Gtk.Orientation.VERTICAL} spacing={1} valign={Gtk.Align.CENTER} class="clock-details">
              <label label={weekday} class="clock-weekday" xalign={0} />
              <label label={date} class="clock-date" xalign={0} />
            </box>
          </box>
        </box>
      </window>
      <window {...common} name="center-islands-expanded" visible={false}
        anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.LEFT}
        $={self => {
          playerWindow = self
          playerReveal = createFluidReveal({
            window: self,
            child: playerCard,
            driver: musicSummary,
            getOriginX: () => musicSummary.get_width() / 2,
            onJoinedChanged: setPlayerJoined,
          })
        }}>
      </window>
    </>
  )
}

app.start({
  instanceName: "music-island",
  css,
  main() {
    return <For each={createBinding(app, "monitors")}>
      {/* One window set per monitor; For handles monitor additions/removals. */}
      {(monitor) => {
        const windows = [...CenterIslands({ monitor })] as Gtk.Window[]
        // For owns the first window; dispose the remaining fragment windows here.
        onCleanup(() => windows.slice(1).forEach(window => window.destroy()))
        return windows[0]
      }}
    </For>
  },
})
