import app from "ags/gtk4/app";
import { Astal, Gtk, Gdk } from "ags/gtk4";
import { createPoll } from "ags/time";
import { execAsync, subprocess } from "ags/process";
import { createState, createBinding, createComputed, createEffect, For, onCleanup } from "ags";
import GLib from "gi://GLib";
import { createFluidReveal } from "../island-shared/fluid-reveal";

const script = `${GLib.get_home_dir()}/.config/right-islands/status.py`;
const connectionHeight = 18;
const empty = {
  cpu: 0,
  ram: 0,
  temp: null as number | null,
  battery: null as number | null,
  charging: false,
  chargeLimit: null as number | null,
  wifi: false,
  ssid: "",
  bluetooth: false,
};
const emptyAudio = {
  sink: { volume: 0, muted: false },
  source: { volume: 0, muted: false },
};

function RightIslands({ monitor }: { monitor: Gdk.Monitor }) {
  const poll = createPoll(JSON.stringify(empty), 2500, `python ${script}`);
  const info = poll((s: string) => {
    try {
      return { ...empty, ...JSON.parse(s) };
    } catch {
      return empty;
    }
  });
  // Audio is independent of the 2.5 s system poll: refresh after commands and
  // on PipeWire/PulseAudio events, including changes made outside this panel.
  const [audio, setAudio] = createState(emptyAudio);
  let audioRevision = 0;
  let disposed = false;
  const parseAudio = (value: string) => ({
    volume: Math.round(Number(value.match(/Volume:\s+([\d.]+)/)?.[1] ?? 0) * 100),
    muted: value.includes("[MUTED]"),
  });
  const refreshAudio = async () => {
    const revision = ++audioRevision;
    try {
      const [sink, source] = await Promise.all([
        execAsync(["wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@"]),
        execAsync(["wpctl", "get-volume", "@DEFAULT_AUDIO_SOURCE@"]),
      ]);
      // Discard older reads when another event or click has already requested one.
      if (!disposed && revision === audioRevision) {
        setAudio({ sink: parseAudio(sink), source: parseAudio(source) });
      }
    } catch (e) {
      console.error(e);
    }
  };
  const audioEvents = subprocess(["pactl", "subscribe"], (event) => {
    if (/ on (sink|source|server) /.test(event)) void refreshAudio();
  });
  void refreshAudio();
  onCleanup(() => {
    disposed = true;
    audioEvents.kill();
  });
  const audioCommand = async (cmd: string) => {
    try {
      await execAsync(cmd);
      await refreshAudio();
    } catch (e) {
      console.error(e);
    }
  };
  const [activePanel, setActivePanel] = createState<
    "none" | "stats" | "controls"
  >("none");

  const [statsJoined, setStatsJoined] = createState(false);
  const [controlsJoined, setControlsJoined] = createState(false);
  const statsGeometry = { shoulderWidth: 0 };
  const controlsGeometry = { shoulderWidth: 0 };
  type RevealController = {
    setOpen(open: boolean): void;
    closeImmediately(): void;
    dispose(): void;
  };
  let statsReveal: RevealController;
  let controlsReveal: RevealController;
  let closeTimer = 0;
  const cancelClose = () => {
    if (closeTimer) GLib.source_remove(closeTimer);
    closeTimer = 0;
  };
  const scheduleClose = (panel: "stats" | "controls") => {
    cancelClose();
    // Allow brief pointer excursions without flickering the connected glass shape.
    closeTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 160, () => {
      closeTimer = 0;
      if (activePanel.peek() === panel) {
        setActivePanel("none");
        (panel === "stats" ? statsReveal : controlsReveal).setOpen(false);
      }
      return GLib.SOURCE_REMOVE;
    });
  };
  onCleanup(() => {
    cancelClose();
    statsReveal?.dispose();
    controlsReveal?.dispose();
  });
  const command = (cmd: string) => {
    try {
      GLib.spawn_command_line_async(cmd);
    } catch (e) {
      console.error(e);
    }
  };
  const [chargeLimit, setChargeLimit] = createState<number | null>(null);
  const [chargeBusy, setChargeBusy] = createState(false);
  const [chargeError, setChargeError] = createState("");
  let chargeTimer = 0;
  let syncingChargeSlider = false;
  createEffect(() => {
    const actual = info().chargeLimit;
    if (!chargeBusy.peek() && !chargeTimer) setChargeLimit(actual);
  });
  const changeChargeLimit = (limit: number) => {
    setChargeLimit(limit);
    setChargeError("");
    if (chargeTimer) GLib.source_remove(chargeTimer);
    chargeTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
      chargeTimer = 0;
      setChargeBusy(true);
      void execAsync(["pkexec", "/usr/local/libexec/e14-charge-limit", String(limit)])
        .catch((error) => {
          if (disposed) return;
          console.error(error);
          setChargeLimit(info.peek().chargeLimit);
          setChargeError("Ladegrenze konnte nicht gesetzt werden");
        })
        .finally(() => { if (!disposed) setChargeBusy(false); });
      return GLib.SOURCE_REMOVE;
    });
  };
  onCleanup(() => {
    if (chargeTimer) GLib.source_remove(chargeTimer);
  });
  const meter = (title: string, value: any) => (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={4}>
      <box>
        <label label={title} xalign={0} hexpand />
        <label label={value((v: number) => `${v}%`)} />
      </box>
      <levelbar
        value={value((v: number) => Math.max(0, Math.min(1, v / 100)))}
        class="meter"
      />
    </box>
  );
  const statsDetails = (
        <box
          class="details"
          orientation={Gtk.Orientation.VERTICAL}
          spacing={13}
        >
          <label label="SYSTEM MONITOR" class="section-title" xalign={0} />
          {meter(
            "CPU",
            info((d) => d.cpu),
          )}
          {meter(
            "RAM",
            info((d) => d.ram),
          )}
          <box>
            <label label="Temperatur" hexpand xalign={0} />
            <label
              label={info((d) =>
                d.temp === null ? "Nicht erkannt" : `${d.temp} °C`,
              )}
            />
          </box>
          <box visible={info((d) => d.battery !== null)}>
            <label label="Akku" hexpand xalign={0} />
            <label
              label={info(
                (d) => `${d.battery ?? 0}%${d.charging ? " · Laden" : ""}`,
              )}
            />
          </box>
          <box
            visible={info((d) => d.battery !== null)}
            orientation={Gtk.Orientation.VERTICAL}
            spacing={6}
          >
            <box>
              <label label="Bis" hexpand xalign={0} />
              <label label={chargeLimit((limit) =>
                limit === null ? "Nicht unterstützt" : `${limit} % laden`)} />
            </box>
            <slider
              min={70}
              max={100}
              step={5}
              page={5}
              roundDigits={0}
              drawValue={false}
              sensitive={createComputed(() => !chargeBusy() && info().chargeLimit !== null)}
              tooltipText="Akkuschonung: 70–100 % in 5er-Schritten"
              $={(self) => {
                self.update_property([Gtk.AccessibleProperty.LABEL], ["Ladegrenze"]);
                createEffect(() => {
                  syncingChargeSlider = true;
                  self.set_value(chargeLimit() ?? 70);
                  syncingChargeSlider = false;
                });
              }}
              onValueChanged={(self) => {
                if (syncingChargeSlider || chargeLimit.peek() === null ||
                    chargeBusy.peek()) return;
                const limit = Math.max(70, Math.min(100, Math.round(self.get_value() / 5) * 5));
                syncingChargeSlider = true;
                self.set_value(limit);
                syncingChargeSlider = false;
                if (limit !== chargeLimit.peek()) changeChargeLimit(limit);
              }}
            />
            <box>
              <label label="70 %" hexpand xalign={0} />
              <label label="100 %" />
            </box>
            <label
              visible={chargeBusy}
              label="Ladegrenze wird übernommen …"
              xalign={0}
            />
            <label
              visible={chargeError((error) => error !== "")}
              label={chargeError}
              wrap
              maxWidthChars={32}
              xalign={0}
            />
          </box>
        </box>
  );
  const controlsDetails = (
        <box
          class="details controls-details"
          orientation={Gtk.Orientation.VERTICAL}
          spacing={10}
        >
          <label label="CONTROL CENTER" class="section-title" xalign={0} />
          <box spacing={8} homogeneous>
            <button
              class="tile"
              onClicked={() => command("nm-connection-editor")}
            >
              <label
                label={info((d) =>
                  d.wifi ? `󰤨  ${d.ssid || "WLAN"}` : "󰤭  WLAN aus",
                )}
              />
            </button>
            <button class="tile" onClicked={() => command("blueman-manager")}>
              <label
                label={info((d) =>
                  d.bluetooth ? "󰂯  Bluetooth" : "󰂲  Bluetooth aus",
                )}
              />
            </button>
          </box>
          <box spacing={8} homogeneous>
            <button
              class="tile"
              onClicked={() =>
                audioCommand("wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle")
              }
            >
              <label
                label={audio((d) => (d.sink.muted ? "󰝟  Ton aus" : "󰕾  Ton an"))}
              />
            </button>
            <button
              class="tile"
              onClicked={() =>
                audioCommand("wpctl set-mute @DEFAULT_AUDIO_SOURCE@ toggle")
              }
            >
              <label
                label={audio((d) =>
                  d.source.muted ? "󰍭  Mic aus" : "󰍬  Mic an",
                )}
              />
            </button>
          </box>
          <box spacing={8}>
            <label
              label={audio((d) => `󰕾  ${d.sink.volume}%`)}
              hexpand
              xalign={0}
            />
            <button
              class="tile"
              label="−"
              onClicked={() =>
                audioCommand("wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%-")
              }
            />
            <button
              class="tile"
              label="+"
              onClicked={() =>
                audioCommand("wpctl set-volume -l 1 @DEFAULT_AUDIO_SINK@ 5%+")
              }
            />
          </box>
          <box spacing={8}>
            <label
              label={audio((d) => `󰍬  ${d.source.volume}%`)}
              hexpand
              xalign={0}
            />
            <button
              class="tile"
              label="−"
              onClicked={() =>
                audioCommand("wpctl set-volume @DEFAULT_AUDIO_SOURCE@ 5%-")
              }
            />
            <button
              class="tile"
              label="+"
              onClicked={() =>
                audioCommand("wpctl set-volume -l 1 @DEFAULT_AUDIO_SOURCE@ 5%+")
              }
            />
          </box>
          <box spacing={8} homogeneous>
            <button class="tile" onClicked={() => command("swaync-client -t")}>
              <label label="󰂚  Mitteilungen" />
            </button>
            <button class="tile" onClicked={() => command("pavucontrol")}>
              <label label="󰒓  Audiogeräte" />
            </button>
          </box>
        </box>
  );
  const connectDetails = (details: Gtk.Widget, geometry: { shoulderWidth: number }) => {
    const canvas = new Gtk.DrawingArea();
    canvas.set_draw_func((_area, cr, width, height) => {
      const shoulder = geometry.shoulderWidth;
      const radius = connectionHeight;
      // One continuous, pixel-centred outline: no clipped stroke at the neck/body seam.
      cr.moveTo(shoulder + 0.5, -1);
      cr.lineTo(shoulder + 0.5, 0);
      cr.arc(shoulder - radius, 0, radius + 0.5, 0, Math.PI / 2);
      cr.lineTo(radius, connectionHeight + 0.5);
      cr.arcNegative(radius, connectionHeight + radius, radius - 0.5, -Math.PI / 2, -Math.PI);
      cr.lineTo(0.5, height - radius);
      cr.arcNegative(radius, height - radius, radius - 0.5, Math.PI, Math.PI / 2);
      cr.lineTo(width - radius, height - 0.5);
      cr.arcNegative(width - radius, height - radius, radius - 0.5, Math.PI / 2, 0);
      cr.lineTo(width - 0.5, -1);
      const [, color] = _area.get_style_context().lookup_color("island_bg");
      cr.setSourceRGBA(color.red, color.green, color.blue, color.alpha);
      cr.fillPreserve();
      cr.setSourceRGBA(1, 1, 1, 0.25);
      cr.setLineWidth(1);
      cr.stroke();
    });
    const content = (
      <box orientation={Gtk.Orientation.VERTICAL} marginTop={connectionHeight}>
        {details}
      </box>
    );
    const overlay = new Gtk.Overlay({ child: canvas });
    overlay.add_overlay(content);
    overlay.set_measure_overlay(content, true);
    return { overlay, canvas };
  };
  const statsConnection = connectDetails(statsDetails, statsGeometry);
  const controlsConnection = connectDetails(controlsDetails, controlsGeometry);
  const statsContent = (
    <box>
      <Gtk.EventControllerMotion
        onEnter={() => openPanel("stats")}
        onLeave={() => scheduleClose("stats")}
      />
      {statsConnection.overlay}
    </box>
  ) as Gtk.Widget;
  const controlsContent = (
    <box>
      <Gtk.EventControllerMotion
        onEnter={() => openPanel("controls")}
        onLeave={() => scheduleClose("controls")}
      />
      {controlsConnection.overlay}
    </box>
  ) as Gtk.Widget;
  const common = {
    gdkmonitor: monitor,
    anchor: Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT,
    exclusivity: Astal.Exclusivity.IGNORE,
    marginTop: 9,
    marginRight: 12,
    application: app,
    namespace: "right-islands",
    class: "right-window",
  };
  let statsWindow: Astal.Window;
  let controlsWindow: Astal.Window;
  let summary: Gtk.Box;
  let statsSummary: Gtk.Box;
  let controlsSummary: Gtk.Box;
  const openPanel = (panel: "stats" | "controls") => {
    cancelClose();
    const window = panel === "stats" ? statsWindow : controlsWindow;
    // Measure only the permanent row: expanded content never participates in its layout.
    window.margin_top = common.marginTop + summary.get_height();
    window.margin_right = common.marginRight +
      (panel === "stats" ? controlsSummary.get_width() + 12 : 0);
    const details = panel === "stats" ? statsDetails : controlsDetails;
    const selectedSummary = panel === "stats" ? statsSummary : controlsSummary;
    const islandWidth = selectedSummary.get_width();
    const geometry = panel === "stats" ? statsGeometry : controlsGeometry;
    const connection = panel === "stats" ? statsConnection : controlsConnection;
    // Leave room for both the outer corner and the concave neck on the left shoulder.
    const [, detailWidth] = details.measure(Gtk.Orientation.HORIZONTAL, -1);
    const shoulderWidth = Math.max(0, detailWidth - islandWidth);
    if (geometry.shoulderWidth !== shoulderWidth) {
      geometry.shoulderWidth = shoulderWidth;
      connection.canvas.queue_draw();
    }
    setActivePanel(panel);
    statsReveal.setOpen(panel === "stats");
    controlsReveal.setOpen(panel === "controls");
  };
  return (
    <>
      <window {...common} name="right-summary" visible>
        <box class="panel-row" spacing={12} $={(self) => { summary = self; }}>
          <box $={(self) => { statsSummary = self; }}>
          <box class={statsJoined((joined) => `glass compact${joined ? " joined" : ""}`)} spacing={13}>
            <Gtk.EventControllerMotion
              onEnter={() => openPanel("stats")}
              onLeave={() => scheduleClose("stats")}
            />
            <label widthChars={6} label={info((d) => ` ${d.cpu}%`)} />
            <label widthChars={6} label={info((d) => ` ${d.ram}%`)} />
            <label widthChars={6} label={info((d) => d.temp === null ? " --" : ` ${d.temp}°`)} />
            <label widthChars={6} visible={info((d) => d.battery !== null)} label={info((d) => `󰁹 ${d.battery ?? 0}%`)} />
          </box>
          </box>
          {/* Measure the unstyled wrapper, including the island's CSS padding and border. */}
          <box $={(self) => { controlsSummary = self; }}>
          <box class={controlsJoined((joined) => `glass compact${joined ? " joined" : ""}`)} spacing={15}>
            <Gtk.EventControllerMotion
              onEnter={() => openPanel("controls")}
              onLeave={() => scheduleClose("controls")}
            />
            <label label={info((d) => d.wifi ? "󰤨" : "󰤭")} />
            <label label={info((d) => d.bluetooth ? "󰂯" : "󰂲")} />
            <label class={audio((d) => d.sink.muted ? "muted" : "")} label={audio((d) => `${d.sink.muted ? "󰝟" : "󰕾"} ${d.sink.volume}%`)} />
            <label class={audio((d) => d.source.muted ? "muted" : "")} label={audio((d) => `${d.source.muted ? "󰍭" : "󰍬"} ${d.source.volume}%`)} />
            <label label="󰂚" />
          </box>
          </box>
        </box>
      </window>
      <window {...common} name="right-stats" visible={false}
        $={(self) => {
          statsWindow = self;
          statsReveal = createFluidReveal({
            window: self,
            child: statsContent,
            driver: statsSummary,
            onJoinedChanged: setStatsJoined,
          });
        }}
      />
      <window {...common} name="right-controls" visible={false}
        $={(self) => {
          controlsWindow = self;
          controlsReveal = createFluidReveal({
            window: self,
            child: controlsContent,
            driver: controlsSummary,
            onJoinedChanged: setControlsJoined,
          });
        }}
      />
    </>
  );
}
app.start({
  instanceName: "right-islands",
  css: `${GLib.get_home_dir()}/.config/right-islands/style.css`,
  main() {
    return <For each={createBinding(app, "monitors")}>
      {/* One window set per monitor; For handles monitor additions/removals. */}
      {(monitor) => {
        const windows = [...RightIslands({ monitor })] as Gtk.Window[];
        // For owns the first window; dispose the remaining fragment windows here.
        onCleanup(() => windows.slice(1).forEach(window => window.destroy()));
        return windows[0];
      }}
    </For>;
  },
});
