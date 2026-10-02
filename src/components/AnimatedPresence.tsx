import { cloneElement, ReactElement, useLayoutEffect, useReducer, useRef } from "react"

type SurfaceProps = { className?: string; "data-motion-state"?: string; inert?: boolean }

/** Retain only the departing surface briefly; actions and state updates remain immediate. */
export default function AnimatedPresence({ children, kind = "modal" }: {
  children: ReactElement<SurfaceProps> | false | null
  kind?: "modal" | "reveal"
}) {
  const previous = useRef<ReactElement<SurfaceProps> | null>(null)
  const [, refresh] = useReducer((value: number) => value + 1, 0)
  useLayoutEffect(() => {
    if (children) {
      previous.current = children
      return
    }
    if (!previous.current) return
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const remove = () => {
      previous.current = null
      refresh()
    }
    if (preference.matches) {
      remove()
      return
    }
    const timeout = window.setTimeout(remove, 150)
    const onPreferenceChange = () => { if (preference.matches) remove() }
    preference.addEventListener("change", onPreferenceChange)
    return () => {
      window.clearTimeout(timeout)
      preference.removeEventListener("change", onPreferenceChange)
    }
  }, [children])
  const surface = children || previous.current
  if (!surface) return null
  return cloneElement(surface, {
    className: `${surface.props.className ?? ""} motion-${kind}`,
    "data-motion-state": children ? "open" : "closed",
    inert: children ? surface.props.inert : true,
  })
}
