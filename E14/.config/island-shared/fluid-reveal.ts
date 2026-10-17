import Gtk from "gi://Gtk?version=4.0"
import GObject from "gi://GObject"
import Gsk from "gi://Gsk?version=4.0"
import Graphene from "gi://Graphene"
import Adw from "gi://Adw?version=1"
import Cairo from "cairo"

const FluidReveal = GObject.registerClass(
  class FluidReveal extends Gtk.Widget {
    content: Gtk.Widget | null = null
    progress = 0
    origin = (_width: number) => 0

    vfunc_measure(orientation: Gtk.Orientation, forSize: number) {
      return this.content?.measure(orientation, forSize) ?? [0, 0, -1, -1]
    }

    vfunc_contains(x: number, y: number) {
      const width = this.get_width()
      const a = Math.max(0, Math.min(width, this.origin(width)))
      const left = a * (1 - this.progress)
      return this.progress > 0 && x >= left && x < left + width * this.progress &&
        y >= 0 && y < this.get_height() * this.progress
    }

    updateInput(width: number, height: number) {
      const surface = (this.get_root() as Gtk.Window | null)?.get_surface()
      if (!surface) return
      const region = new Cairo.Region()
      if (this.progress > 0 && width > 0 && height > 0) {
        const a = Math.max(0, Math.min(width, this.origin(width)))
        const left = Math.max(0, Math.floor(a * (1 - this.progress)))
        const right = Math.min(surface.get_width(), Math.ceil(a * (1 - this.progress) + width * this.progress))
        const bottom = Math.min(surface.get_height(), Math.ceil(height * this.progress))
        if (right > left && bottom > 0)
          region.unionRectangle({ x: left, y: 0, width: right - left, height: bottom })
      }
      surface.set_input_region(region)
    }

    vfunc_size_allocate(width: number, height: number, baseline: number) {
      if (!this.content) return
      const q = this.progress
      const a = Math.max(0, Math.min(width, this.origin(width)))
      // Keep the natural layout; allocation transforms also drive GTK picking.
      this.content.set_child_visible(q > 0)
      if (q > 0) {
        const transform = new Gsk.Transform()
          .translate(new Graphene.Point({ x: a * (1 - q), y: 0 }))
          .scale(q, q)
        this.content.allocate(width, height, baseline, transform)
      }
      this.updateInput(width, height)
    }

    vfunc_snapshot(snapshot: Gtk.Snapshot) {
      if (this.content && this.progress > 0) this.snapshot_child(this.content, snapshot)
    }
  },
)

export function createFluidReveal(options: {
  window: Gtk.Window;
  child: Gtk.Widget;
  driver: Gtk.Widget;
  getOriginX: (width: number) => number;
  onJoinedChanged: (joined: boolean) => void;
}): {
  setOpen(open: boolean): void;
  closeImmediately(): void;
  dispose(): void;
} {
  const { window, child, driver, getOriginX, onJoinedChanged } = options
  const wrapper = new FluidReveal()
  wrapper.content = child
  wrapper.origin = getOriginX
  child.set_parent(wrapper)
  window.set_child(wrapper)
  let desired = false
  let joined = false
  let disposed = false
  const render = (value: number) => {
    if (disposed) return
    wrapper.progress = Math.max(0, Math.min(1, value))
    // Keep the compact contour until the expanding card nearly fills its attachment.
    const nextJoined = wrapper.progress >= 0.9
    if (joined !== nextJoined) {
      joined = nextJoined
      onJoinedChanged(joined)
    }
    wrapper.queue_allocate()
    wrapper.queue_draw()
  }
  const animation = Adw.SpringAnimation.new(
    driver, 0, 0, Adw.SpringParams.new(1, 1, 500),
    Adw.CallbackAnimationTarget.new(render),
  ) as Adw.SpringAnimation
  animation.set_epsilon(0.001)
  animation.set_clamp(true)
  const hide = () => {
    render(0)
    wrapper.updateInput(0, 0)
    window.set_visible(false)
  }
  const realizeId = window.connect("realize", () => {
    if (!disposed) wrapper.updateInput(0, 0)
  })
  const doneId = animation.connect("done", () => {
    if (disposed) return
    if (desired) render(1)
    else hide()
  })
  return {
    setOpen(open) {
      if (disposed || desired === open) return
      const value = animation.get_value()
      const velocity = animation.get_velocity()
      animation.pause()
      desired = open
      animation.set_value_from(value)
      animation.set_value_to(open ? 1 : 0)
      animation.set_initial_velocity(velocity)
      if (open) {
        window.set_visible(true)
      }
      // play() can synchronously finish when GTK animations are disabled.
      animation.play()
    },
    closeImmediately() {
      if (disposed) return
      desired = false
      animation.pause()
      animation.set_value_from(0)
      animation.set_value_to(0)
      animation.set_initial_velocity(0)
      animation.reset()
      hide()
    },
    dispose() {
      if (disposed) return
      disposed = true
      desired = false
      window.disconnect(realizeId)
      animation.disconnect(doneId)
      animation.pause()
      wrapper.progress = 0
      wrapper.updateInput(0, 0)
      window.set_visible(false)
      if (joined) {
        joined = false
        onJoinedChanged(false)
      }
      child.unparent()
      wrapper.content = null
      window.set_child(null)
    },
  }
}
