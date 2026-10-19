import Gtk from "gi://Gtk?version=4.0"
import GObject from "gi://GObject"
import Gsk from "gi://Gsk?version=4.0"
import Graphene from "gi://Graphene"
import Adw from "gi://Adw?version=1"
import Cairo from "cairo"

// Reserve spring overshoot without resizing the Wayland surface on every frame.
const springExtent = 1.1

// GTK picking clips to allocation, not snapshot clips or the parent's contains().
const RollViewport = GObject.registerClass(
  class RollViewport extends Gtk.Widget {
    content: Gtk.Widget | null = null
    contentHeight = 0
    stretch = 1

    vfunc_size_allocate(width: number, _height: number, baseline: number) {
      this.content?.allocate(width, this.contentHeight, baseline,
        new Gsk.Transform().scale(1, this.stretch))
    }

    vfunc_snapshot(snapshot: Gtk.Snapshot) {
      if (this.content) this.snapshot_child(this.content, snapshot)
    }
  },
)

const FluidReveal = GObject.registerClass(
  class FluidReveal extends Gtk.Widget {
    viewport: InstanceType<typeof RollViewport> | null = null
    progress = 0
    contentHeight = 0

    vfunc_measure(orientation: Gtk.Orientation, forSize: number) {
      const [minimum, natural, minBaseline, natBaseline] =
        this.viewport?.content?.measure(orientation, forSize) ?? [0, 0, -1, -1]
      return orientation === Gtk.Orientation.VERTICAL
        ? [Math.ceil(minimum * springExtent), Math.ceil(natural * springExtent), -1, -1]
        : [minimum, natural, minBaseline, natBaseline]
    }

    vfunc_contains(x: number, y: number) {
      return this.progress > 0 && x >= 0 && x < this.get_width() &&
        y >= 0 && y < this.contentHeight * this.progress
    }

    updateInput(width: number, height: number) {
      const surface = (this.get_root() as Gtk.Window | null)?.get_surface()
      if (!surface) return
      const region = new Cairo.Region()
      if (this.progress > 0 && width > 0 && height > 0) {
        const right = Math.min(surface.get_width(), width)
        const bottom = Math.min(surface.get_height(), Math.ceil(height * this.progress))
        if (right > 0 && bottom > 0)
          region.unionRectangle({ x: 0, y: 0, width: right, height: bottom })
      }
      surface.set_input_region(region)
    }

    vfunc_size_allocate(width: number, height: number, baseline: number) {
      if (!this.viewport) return
      const q = this.progress
      this.contentHeight = Math.floor(height / springExtent)
      // Unroll at natural size; only the small overshoot stretches the surface.
      this.viewport.set_child_visible(q > 0)
      if (q > 0) {
        this.viewport.contentHeight = this.contentHeight
        this.viewport.stretch = Math.max(1, q)
        this.viewport.allocate(width, Math.ceil(this.contentHeight * q), baseline, null)
      }
      this.updateInput(width, this.contentHeight)
    }

    vfunc_snapshot(snapshot: Gtk.Snapshot) {
      if (!this.viewport || this.progress <= 0) return
      const height = this.contentHeight * this.progress
      const bounds = new Graphene.Rect()
      bounds.init(0, 0, this.get_width(), height)
      const square = new Graphene.Size({ width: 0, height: 0 })
      const radius = Math.min(18, height / 2)
      const corner = new Graphene.Size({ width: radius, height: radius })
      const clip = new Gsk.RoundedRect()
      clip.init(bounds, square, square, corner, corner)
      snapshot.push_rounded_clip(clip)
      this.snapshot_child(this.viewport, snapshot)
      snapshot.pop()
    }
  },
)

export function createFluidReveal(options: {
  window: Gtk.Window;
  child: Gtk.Widget;
  driver: Gtk.Widget;
  onJoinedChanged: (joined: boolean) => void;
}): {
  setOpen(open: boolean): void;
  closeImmediately(): void;
  dispose(): void;
} {
  const { window, child, driver, onJoinedChanged } = options
  const wrapper = new FluidReveal()
  const viewport = new RollViewport({ overflow: Gtk.Overflow.HIDDEN })
  viewport.content = child
  child.set_parent(viewport)
  viewport.set_parent(wrapper)
  wrapper.viewport = viewport
  window.set_child(wrapper)
  let desired = false
  let joined = false
  let disposed = false
  const render = (value: number) => {
    if (disposed) return
    wrapper.progress = Math.max(0, Math.min(springExtent, value))
    // The full-width reveal meets the header as soon as it becomes visible.
    const nextJoined = wrapper.progress > 0
    if (joined !== nextJoined) {
      joined = nextJoined
      onJoinedChanged(joined)
    }
    wrapper.queue_allocate()
    wrapper.queue_draw()
  }
  const animation = Adw.SpringAnimation.new(
    driver, 0, 0, Adw.SpringParams.new(0.65, 1, 500),
    Adw.CallbackAnimationTarget.new(render),
  ) as Adw.SpringAnimation
  animation.set_epsilon(0.001)
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
      // Bounce only at the open end; closing must not flash back into view.
      animation.set_clamp(!open)
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
      viewport.content = null
      viewport.unparent()
      wrapper.viewport = null
      window.set_child(null)
    },
  }
}
