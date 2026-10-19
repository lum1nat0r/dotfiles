#!/usr/bin/env -S ags run
import Gtk from "gi://Gtk?version=4.0"
import Adw from "gi://Adw?version=1"
import GLib from "gi://GLib"
import System from "system"
import { createFluidReveal } from "../E14/.config/island-shared/fluid-reveal"

Gtk.init()
Adw.init()
const loop = new GLib.MainLoop(null, false)
const settings = Gtk.Settings.get_default()!
const originalAnimations = settings.gtk_enable_animations
settings.gtk_enable_animations = true
const header = new Gtk.Box({ width_request: 180, height_request: 40, css_classes: ["music-shell"] })
header.append(new Gtk.Label({ label: "Permanent header" }))
const rightHeader = new Gtk.Box({ css_classes: ["glass", "compact"] })
rightHeader.append(new Gtk.Label({ label: "Stats" }))
const row = new Gtk.Box()
row.append(header)
row.append(rightHeader)
const driver = new Gtk.Window({ decorated: false, resizable: false, child: row })
const providers = ["music-island", "right-islands"].map(name => {
  const provider = new Gtk.CssProvider()
  provider.load_from_path(`E14/.config/${name}/style.css`)
  Gtk.StyleContext.add_provider_for_display(driver.get_display(), provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)
  return provider
})
const child = new Gtk.Box({ width_request: 300, height_request: 200 })
const button = new Gtk.Button({ label: "Harmless target", hexpand: true, vexpand: true })
child.append(button)
const popup = new Gtk.Window({ decorated: false, resizable: false })
const reveal = createFluidReveal({
  window: popup, child, driver: header,
  onJoinedChanged: joined => {
    for (const summary of [header, rightHeader]) {
      if (joined) summary.add_css_class("joined")
      else summary.remove_css_class("joined")
    }
  },
})
const wrapper = popup.get_child()!
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
const delay = (ms: number) => new Promise<void>(resolve => {
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => { resolve(); return GLib.SOURCE_REMOVE })
})
async function until(predicate: () => boolean, message: string) {
  const deadline = GLib.get_monotonic_time() + 3000000
  while (!predicate()) {
    assert(GLib.get_monotonic_time() < deadline, message)
    await delay(5)
  }
}
type Bounds = { x: number; y: number; width: number; height: number }
function bounds() {
  const [ok, rect] = child.compute_bounds(wrapper)
  assert(ok, "child bounds unavailable")
  return { x: rect.get_x(), y: rect.get_y(), width: rect.get_width(), height: rect.get_height() }
}
function sameBounds(a: Bounds, b: Bounds) {
  for (const key of ["x", "y", "width", "height"] as const)
    assert(Math.abs(a[key] - b[key]) < 0.02, `discontinuous ${key}: ${a[key]} → ${b[key]}`)
}
function visibleBottom() {
  let low = 0
  let high = wrapper.get_height()
  while (high - low > 0.01) {
    const middle = (low + high) / 2
    if (wrapper.contains(wrapper.get_width() / 2, middle)) low = middle
    else high = middle
  }
  return low
}
function assertContour(closed: boolean, message: string) {
  for (const summary of [header, rightHeader])
    assert(summary.get_style_context().get_border().bottom === (closed ? 1 : 0), message)
}

async function run() {
  driver.set_visible(true)
  await until(() => header.get_mapped() && header.get_width() > 0, "header did not map")
  const headerSize = [header.get_width(), header.get_height()]
  reveal.setOpen(true)
  assert(popup.get_visible(), "open did not present")
  await until(() => child.get_width() > 0 && visibleBottom() > 10 &&
    visibleBottom() < child.get_height() * 0.8, "no intermediate opening frame")
  const width = child.get_width()
  const height = child.get_height()
  const partial = bounds()
  const edge = visibleBottom()
  sameBounds(partial, { x: 0, y: 0, width, height })
  assert(width === wrapper.get_width(), "opening narrowed the card")
  for (const x of [5, width - 5]) {
    const picked = wrapper.pick(x, edge / 2, Gtk.PickFlags.DEFAULT)
    assert(picked && (picked === button || picked.is_ancestor(button)), "visible edge not pickable")
  }
  assert(wrapper.pick(width / 2, height - 1, Gtk.PickFlags.DEFAULT) === null,
    "unrevealed content intercepted GTK picking")
  reveal.setOpen(true)
  sameBounds(partial, bounds())
  assert(Math.abs(visibleBottom() - edge) < 0.02, "repeated open jumped the reveal")
  reveal.setOpen(false)
  sameBounds(partial, bounds())
  assert(Math.abs(visibleBottom() - edge) < 0.02, "close jumped the reveal")
  assert(popup.get_visible(), "close hid immediately")
  reveal.setOpen(true)
  sameBounds(partial, bounds())
  assert(Math.abs(visibleBottom() - edge) < 0.02, "reversal jumped the reveal")
  await until(() => bounds().height > height + 0.5, "opening never overshot")
  const overshoot = bounds()
  assert(overshoot.height < height * 1.1, "spring stretched the card excessively")
  assert(overshoot.height <= wrapper.get_height(), "surface clipped the spring overshoot")
  assert(Math.abs(overshoot.x) < 0.02 && Math.abs(overshoot.y) < 0.02 &&
    Math.abs(overshoot.width - width) < 0.02, "spring moved the top edge or changed width")
  await delay(600)
  assert(popup.get_visible(), "stale completion hid reopened popup")
  sameBounds(bounds(), { x: 0, y: 0, width, height })
  assertContour(false, "fully open header retained its bottom border")
  assert(header.get_width() === headerSize[0] && header.get_height() === headerSize[1], "header moved")
  assert(wrapper.pick(width / 2, height + 1, Gtk.PickFlags.DEFAULT) === null,
    "unused spring clearance intercepted GTK picking")
  reveal.setOpen(false)
  assert(popup.get_visible(), "close did not animate")
  await until(() => visibleBottom() < height * 0.8 && visibleBottom() > 10, "no intermediate closing frame")
  const closing = bounds()
  const closingEdge = visibleBottom()
  sameBounds(closing, { x: 0, y: 0, width, height })
  reveal.setOpen(true)
  sameBounds(closing, bounds())
  assert(Math.abs(visibleBottom() - closingEdge) < 0.02, "closing reentry jumped the reveal")
  await until(() => bounds().height > height + 0.5, "closing reentry failed")
  await delay(600)
  assert(popup.get_visible(), "late close completion hid popup")
  assertContour(false, "reopened header did not rejoin")
  reveal.setOpen(false)
  await until(() => !popup.get_visible(), "close never hid popup")
  assertContour(true, "closed header did not restore its contour")
  await delay(200)
  assert(!popup.get_visible(), "closing spring bounced back into view")
  print("PASS full-width roll, natural-size content, clipped picking and fixed header")
  print("PASS open overshoot, continuous reversals and close without rebound")

  settings.gtk_enable_animations = false
  reveal.setOpen(true)
  assert(popup.get_visible(), "disabled-animation open failed")
  await until(() => child.get_mapped() && Math.abs(visibleBottom() - height) < 0.02,
    "disabled-animation full size failed")
  assertContour(false, "disabled-animation open did not join header")
  reveal.setOpen(false)
  assert(!popup.get_visible(), "disabled-animation close not synchronous")
  assertContour(true, "disabled-animation close did not restore header")
  print("PASS disabled GTK animations")

  settings.gtk_enable_animations = true
  reveal.setOpen(true)
  await until(() => visibleBottom() > 10 && visibleBottom() < height * 0.9,
    "immediate-close setup did not animate")
  reveal.closeImmediately()
  assert(!popup.get_visible(), "immediate close failed")
  assertContour(true, "immediate close did not restore header")
  await delay(600)
  assert(!popup.get_visible(), "immediate close remapped later")
  reveal.setOpen(true)
  await until(() => visibleBottom() > height * 0.5, "dispose setup did not animate")
  reveal.dispose()
  reveal.dispose()
  assertContour(true, "dispose retained the joined header")
  driver.destroy()
  assert(child.get_parent() === null && popup.get_child() === null, "dispose retained child")
  reveal.setOpen(true)
  await delay(600)
  assert(!popup.get_visible(), "disposed animation remapped window")
  print("PASS immediate close and dispose during motion/driver destruction")
}
let exitCode = 0
run().catch(error => {
  printerr(`${error}\n${error.stack}`)
  printerr(`popup=${popup.get_visible()}/${popup.get_mapped()} wrapper=${wrapper.get_width()}x${wrapper.get_height()} child=${child.get_width()}x${child.get_height()}`)
  exitCode = 1
}).finally(() => {
  reveal.dispose()
  popup.destroy()
  driver.destroy()
  settings.gtk_enable_animations = originalAnimations
  for (const provider of providers)
    Gtk.StyleContext.remove_provider_for_display(driver.get_display(), provider)
  loop.quit()
})
loop.run()
System.exit(exitCode)
