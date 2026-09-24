import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

const DELAY = 350
const GAP = 6
const EDGE = 8

/** A small label shown on hover or keyboard focus.

    Wraps its child in an inline span and portals the bubble to <body>, so
    scrolling panes and the transforms on a dragged collection cannot clip or
    carry it. Prefer this over `title`, which is slow, unstyled and cannot be
    themed. */
export function Tooltip({
  label,
  side = "top",
  children,
}: {
  label: React.ReactNode
  side?: "top" | "bottom"
  children: React.ReactNode
}) {
  const anchor = useRef<HTMLSpanElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const timer = useRef<number>(undefined)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  const show = () => {
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(true), DELAY)
  }
  const hide = () => {
    clearTimeout(timer.current)
    setOpen(false)
    setPos(null)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  // measured after the bubble renders, so it can be centred and kept on screen
  useLayoutEffect(() => {
    if (!open || !anchor.current || !bubble.current) return
    const a = anchor.current.getBoundingClientRect()
    const b = bubble.current.getBoundingClientRect()
    const fitsAbove = a.top - GAP - b.height >= EDGE
    const below = side === "bottom" || !fitsAbove
    const left = Math.min(Math.max(a.left + a.width / 2 - b.width / 2, EDGE), innerWidth - b.width - EDGE)
    setPos({ left, top: below ? a.bottom + GAP : a.top - GAP - b.height })
  }, [open, side])

  return (
    <span
      ref={anchor}
      className="inline-flex"
      onPointerEnter={show}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open &&
        createPortal(
          <div
            ref={bubble}
            role="tooltip"
            style={pos ?? { left: -9999, top: -9999 }}
            className="pointer-events-none fixed z-[100] max-w-60 rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-page shadow-md"
          >
            {label}
          </div>,
          document.body,
        )}
    </span>
  )
}
