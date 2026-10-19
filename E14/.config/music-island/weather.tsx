import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState, createComputed, For, onCleanup, type Accessor } from "ags"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"
import { createFluidReveal } from "../island-shared/fluid-reveal"

type Weather = {
  location: string
  temperature: number | null
  code: number
  isDay: boolean
  days: { date: string; code: number; min: number; max: number; precipitation: number }[]
  error: string
}

export interface WeatherStore {
  data: Accessor<Weather>
  busy: Accessor<boolean>
  refresh(location?: string): Promise<void>
}
const empty: Weather = { location: "", temperature: null, code: 0, isDay: true, days: [], error: "" }
const width = 260

export function createWeather(): WeatherStore {
  const [data, setData] = createState(empty)
  const [busy, setBusy] = createState(false)
  let disposed = false
  const refresh = async (location?: string) => {
    if (busy.peek()) return
    setBusy(true)
    try {
      const args = ["python", `${GLib.get_home_dir()}/.config/music-island/weather.py`]
      if (location !== undefined) args.push("--set-location", location)
      const result: Weather = JSON.parse(await execAsync(args))
      if (!disposed) setData(result)
    } catch (error) {
      console.error(error)
      if (!disposed) setData({ ...data.peek(), error: "Wetter konnte nicht geladen werden" })
    } finally {
      if (!disposed) setBusy(false)
    }
  }
  void refresh()
  const timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 15 * 60 * 1000, () => {
    void refresh()
    return GLib.SOURCE_CONTINUE
  })
  onCleanup(() => { disposed = true; GLib.source_remove(timer) })
  return { data, busy, refresh }
}

function condition(code: number, isDay = true): [string, string] {
  if (code === 0) return [isDay ? "󰖙" : "󰖔", isDay ? "Sonnig" : "Klar"]
  if (code <= 2) return [isDay ? "󰖕" : "󰼱", "Leicht bewölkt"]
  if (code === 3) return ["󰖐", "Bedeckt"]
  if (code === 45 || code === 48) return ["󰖑", "Nebel"]
  if (code >= 95) return ["󰖓", "Gewitter"]
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return ["󰖘", "Schnee"]
  if (code >= 51 && code <= 82) return ["󰖗", "Regen"]
  return ["󰖐", "Wetter"]
}
const degrees = (value: number) => `${Math.round(value)}°`

export function WeatherIsland({ monitor, weather, getRow, application }: {
  monitor: Gdk.Monitor
  weather: WeatherStore
  getRow: () => Gtk.Box
  application: Astal.Application
}) {
  const { data, busy } = weather
  const [joined, setJoined] = createState(false)
  const [editing, setEditing] = createState(false)
  const locationEditor = createComputed(() => editing() || !data().location)
  let header: Gtk.Button
  let popup: Astal.Window
  let entry: Gtk.Entry
  let reveal: {
    setOpen(open: boolean): void
    dispose(): void
  } | undefined
  let disposed = false
  let closeTimer = 0
  const cancelClose = () => {
    if (closeTimer) GLib.source_remove(closeTimer)
    closeTimer = 0
  }
  const open = () => {
    cancelClose()
    const row = getRow()
    const [ok, bounds] = header.compute_bounds(row)
    if (!ok) return
    popup.margin_left = Math.max(0, Math.round((monitor.get_geometry().width - row.get_width()) / 2 + bounds.get_x()))
    popup.margin_top = 9 + header.get_allocated_height()
    reveal?.setOpen(true)
  }
  const close = () => {
    cancelClose()
    closeTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 160, () => {
      closeTimer = 0
      popup.keymode = Astal.Keymode.NONE
      reveal?.setOpen(false)
      return GLib.SOURCE_REMOVE
    })
  }
  const save = () => {
    const query = entry.text.trim()
    if (query && !busy.peek()) {
      void weather.refresh(query).then(() => {
        if (!disposed && !data.peek().error) { entry.text = ""; setEditing(false) }
      })
    }
  }
  onCleanup(() => { disposed = true; cancelClose(); reveal?.dispose() })
  const summary = (
    <button widthRequest={width} valign={Gtk.Align.START}
      class={joined(value => `weather-shell weather-summary${value ? " joined" : ""}`)}
      onClicked={open}
      $={self => { header = self }}>
      <Gtk.EventControllerMotion onEnter={open} onLeave={close} />
      <box spacing={10}>
        <label class="weather-icon" label={data(d => d.temperature === null ? "󰖐" : condition(d.code, d.isDay)[0])} />
        <label class="weather-temperature" label={data(d => d.temperature === null ? "—" : degrees(d.temperature))} />
        <label hexpand xalign={0} ellipsize={3} maxWidthChars={15} class="weather-location"
          label={data(d => d.location || "Ort wählen")} />
      </box>
    </button>
  ) as Gtk.Button
  const card = (
    <box widthRequest={width} class="weather-shell weather-card" orientation={Gtk.Orientation.VERTICAL} spacing={12}>
      <Gtk.EventControllerMotion onEnter={cancelClose} onLeave={close} />
      <box orientation={Gtk.Orientation.VERTICAL} spacing={4}>
        <box spacing={6} visible={createComputed(() => !editing() && !!data().location)}>
          <label hexpand class="weather-heading" xalign={0} label={data(d => d.location)} wrap maxWidthChars={24} />
          <button class="weather-save" label="󰏫" tooltipText="Standort bearbeiten" sensitive={busy(b => !b)}
            onClicked={() => {
              entry.text = data.peek().location.split(",")[0]
              setEditing(true)
              popup.keymode = Astal.Keymode.ON_DEMAND
              entry.grab_focus()
              entry.select_region(0, -1)
            }} />
        </box>
        <label visible={data(d => !d.location)} class="weather-heading" xalign={0} label="Wetter einrichten" />
        <box spacing={6} visible={locationEditor}>
          <entry hexpand widthChars={12} maxLength={100} placeholderText="Ort eingeben …"
            tooltipText="Wetterstandort" onActivate={save} $={self => { entry = self }}>
            <Gtk.GestureClick propagationPhase={Gtk.PropagationPhase.CAPTURE} onPressed={() => {
              popup.keymode = Astal.Keymode.ON_DEMAND
              entry.grab_focus()
            }} />
          </entry>
          <button class="weather-save" label="✓" tooltipText="Wetterstandort übernehmen"
            sensitive={busy(b => !b)} onClicked={save} />
        </box>
        <label class="weather-muted" xalign={0}
          label={data(d => d.temperature === null ? (d.location ? "Aktuell keine Wetterdaten" : "Bitte unten einen Ort eingeben") : `${condition(d.code, d.isDay)[1]} · ${degrees(d.temperature)}C`)} />
      </box>
      <box orientation={Gtk.Orientation.VERTICAL} spacing={9} visible={data(d => d.days.length > 0)}>
        <label class="weather-muted" label="5 TAGE · MIN / MAX · REGEN" xalign={0} />
        <For each={data(d => d.days)}>
          {(day, index) => <box spacing={8} tooltipText={condition(day.code)[1]}>
            <label xalign={0} widthChars={5} label={index(i => i === 0 ? "Heute" : GLib.DateTime.new_from_iso8601(`${day.date}T12:00:00Z`, null)!.format("%a")!)} />
            <label class="forecast-icon" label={condition(day.code)[0]} />
            <label hexpand xalign={1} label={`${degrees(day.min)} / ${degrees(day.max)}`} />
            <label class="weather-muted" xalign={1} widthChars={4} label={`${Math.round(day.precipitation)}%`} />
          </box>}
        </For>
      </box>
      <label visible={data(d => !!d.error)} label={data(d => d.error)} class="weather-error" xalign={0} wrap maxWidthChars={28} />
      <label class="weather-muted weather-source" label={busy(b => b ? "Wetter wird geladen …" : "Open-Meteo · alle 15 Minuten")} xalign={0} />
    </box>
  ) as Gtk.Widget
  const window = (
    <window application={application} gdkmonitor={monitor} name="center-islands-weather"
      namespace="music-island" class="music-window" visible={false}
      anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.LEFT}
      exclusivity={Astal.Exclusivity.IGNORE} keymode={Astal.Keymode.NONE}
      $={self => {
        popup = self
        reveal = createFluidReveal({ window: self, child: card, driver: header,
          onJoinedChanged: setJoined })
      }}>
      <Gtk.EventControllerKey onKeyPressed={(_self, key) => {
        if (key !== Gdk.KEY_Escape) return false
        if (editing.peek()) {
          setEditing(false)
          entry.text = ""
          popup.keymode = Astal.Keymode.NONE
          return true
        }
        cancelClose()
        popup.keymode = Astal.Keymode.NONE
        reveal?.setOpen(false)
        return true
      }} />
    </window>
  ) as Astal.Window
  return { summary, window }
}
