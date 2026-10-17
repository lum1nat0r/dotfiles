#!/usr/bin/env -S ags run
import Gtk from "gi://Gtk?version=4.0"
import Adw from "gi://Adw?version=1"
import GLib from "gi://GLib"
import System from "system"
import { createFluidReveal } from "../E14/.config/island-shared/fluid-reveal"
import musicCss from "../E14/.config/music-island/style.css"
import rightCss from "../E14/.config/right-islands/style.css"

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
const provider = new Gtk.CssProvider()
provider.load_from_string(`${musicCss}\n${rightCss}`)
Gtk.StyleContext.add_provider_for_display(driver.get_display(), provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)
const child = new Gtk.Box({ width_request: 300, height_request: 200 })
const button = new Gtk.Button({ label: "Harmless target", hexpand: true, vexpand: true })
child.append(button)
const popup = new Gtk.Window({ decorated: false, resizable: false })
let rightAnchored = false
const reveal = createFluidReveal({
  window: popup, child, driver: header, getOriginX: width => rightAnchored ? width : 225,
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
  assertContour(true, "header contour disappeared at opening start")
  await until(() => child.get_width() > 0 && bounds().width > 10 && bounds().width < 270, "no intermediate opening frame")
  const partial = bounds()
  const width = wrapper.get_width()
  const height = wrapper.get_height()
  const q = partial.width / width
  assert(Math.abs(partial.x - 225 * (1 - q)) < 0.1 && Math.abs(partial.y) < 0.1, "wrong off-centre/top origin")
  assert(Math.abs(partial.height - height * q) < 0.1, "nonuniform scale")
  assert(child.get_width() === width && child.get_height() === height, "child reflowed")
  assertContour(true, "header contour disappeared during early growth")
  const picked = wrapper.pick(partial.x + partial.width / 2, partial.height / 2, Gtk.PickFlags.DEFAULT)
  assert(picked && (picked === button || picked.is_ancestor(button)), "visible button not pickable")
  assert(wrapper.pick(1, height - 1, Gtk.PickFlags.DEFAULT) === null, "invisible remainder intercepted GTK picking")
  reveal.setOpen(true)
  sameBounds(partial, bounds())
  reveal.setOpen(false)
  sameBounds(partial, bounds())
  assert(popup.get_visible(), "close hid immediately")
  reveal.setOpen(true)
  sameBounds(partial, bounds())
  await until(() => Math.abs(bounds().width - width) < 0.01, "reversal did not fully open")
  await delay(500)
  assert(popup.get_visible(), "stale completion hid reopened popup")
  sameBounds(bounds(), { x: 0, y: 0, width, height })
  assertContour(false, "fully open header retained its bottom border")
  assert(header.get_width() === headerSize[0] && header.get_height() === headerSize[1], "header moved")
  reveal.setOpen(false)
  assert(popup.get_visible(), "close did not animate")
  await until(() => bounds().width < width * 0.8 && bounds().width > 0, "no intermediate closing frame")
  const closing = bounds()
  assertContour(true, "header contour returned too late during shrinking")
  assert(popup.get_visible(), "contour was only restored after hiding")
  reveal.setOpen(true)
  sameBounds(closing, bounds())
  assertContour(true, "reentry prematurely removed the restored contour")
  await until(() => Math.abs(bounds().width - width) < 0.01, "closing reentry failed")
  await delay(500)
  assert(popup.get_visible(), "late close completion hid popup")
  assertContour(false, "reopened header did not rejoin")
  reveal.setOpen(false)
  await until(() => !popup.get_visible(), "close never hid popup")
  print("PASS mapped growth, picking, fixed header, reversals and completed close")
  print("PASS delayed contour removal and early restoration with both real stylesheets")

  rightAnchored = true
  reveal.setOpen(true)
  await until(() => bounds().width > 10 && bounds().width < width * 0.9, "no right-anchored opening frame")
  const cornerOpening = bounds()
  assert(Math.abs(cornerOpening.x + cornerOpening.width - width) < 0.1 &&
    Math.abs(cornerOpening.y) < 0.1, "opening moved the top-right attachment")
  reveal.setOpen(false)
  sameBounds(cornerOpening, bounds())
  await until(() => bounds().width < cornerOpening.width * 0.8 && popup.get_visible(), "no right-anchored closing frame")
  const cornerClosing = bounds()
  assert(Math.abs(cornerClosing.x + cornerClosing.width - width) < 0.1 &&
    Math.abs(cornerClosing.y) < 0.1, "closing moved the top-right attachment")
  await until(() => !popup.get_visible(), "right-anchored close never completed")
  print("PASS fixed top-right attachment while opening and closing")

  settings.gtk_enable_animations = false
  reveal.setOpen(true)
  assert(popup.get_visible(), "disabled-animation open failed")
  await until(() => child.get_mapped() && Math.abs(bounds().width - width) < 0.01, "disabled-animation full size failed")
  assertContour(false, "disabled-animation open did not join header")
  reveal.setOpen(false)
  assert(!popup.get_visible(), "disabled-animation close not synchronous")
  assertContour(true, "disabled-animation close did not restore header")
  print("PASS disabled GTK animations")

  settings.gtk_enable_animations = true
  reveal.setOpen(true)
  await until(() => bounds().width > 10 && bounds().width < width * 0.9, "immediate-close setup did not animate")
  reveal.closeImmediately()
  assert(!popup.get_visible(), "immediate close failed")
  assertContour(true, "immediate close did not restore header")
  await delay(600)
  assert(!popup.get_visible(), "immediate close remapped later")
  reveal.setOpen(true)
  await until(() => bounds().width > width * 0.95 && bounds().width < width, "dispose setup did not animate")
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
  Gtk.StyleContext.remove_provider_for_display(driver.get_display(), provider)
  loop.quit()
})
loop.run()
System.exit(exitCode)
