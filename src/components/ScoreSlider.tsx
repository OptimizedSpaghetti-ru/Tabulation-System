import { useEffect, useState, type CSSProperties, type InputHTMLAttributes } from "react"

type Props = InputHTMLAttributes<HTMLInputElement> & { fill: number }

export default function ScoreSlider({ fill, style, ...props }: Props) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const release = () => setActive(false)
    window.addEventListener("pointerup", release)
    window.addEventListener("pointercancel", release)
    window.addEventListener("blur", release)
    return () => {
      window.removeEventListener("pointerup", release)
      window.removeEventListener("pointercancel", release)
      window.removeEventListener("blur", release)
    }
  }, [])

  return <input {...props} type="range"
    data-active={active && !props.disabled ? "true" : undefined}
    onPointerDown={(event) => {
      if (!props.disabled && event.button === 0) setActive(true)
      props.onPointerDown?.(event)
    }}
    onLostPointerCapture={() => setActive(false)}
    onBlur={(event) => { setActive(false); props.onBlur?.(event) }}
    style={{ ...style, "--score-fill": `${fill}%` } as CSSProperties} />
}
