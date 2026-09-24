import { useEffect, useRef, useState } from "react"
import clsx from "clsx"
import { Check, ChevronDown } from "lucide-react"

import { Tooltip } from "./Tooltip"

/** A toolbar button that opens a small menu below it. Closes on outside click or Escape. */
export function Dropdown({
  icon,
  label,
  active,
  align = "left",
  chevron = true,
  tooltip,
  big = false,
  children,
}: {
  chevron?: boolean
  /** shown on hover while the menu is closed */
  tooltip?: string
  /** a lone icon at the size of the collection header icons */
  big?: boolean
  icon?: React.ReactNode
  label: React.ReactNode
  active?: boolean
  align?: "left" | "right"
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative" onPointerDown={(e) => e.stopPropagation()}>
      {(() => {
        const button = (
          <button
            onClick={() => setOpen(!open)}
            aria-label={tooltip}
            className={clsx(
              "flex items-center gap-1 rounded-md whitespace-nowrap hover:bg-hover",
              big ? "p-1.5 [&>svg]:size-[18px]" : "px-2 py-1 [&>svg]:size-3.5",
              (open || active) && "text-accent",
            )}
          >
            {icon}
            {label}
            {chevron && <ChevronDown className={clsx("transition-transform", open && "rotate-180")} />}
          </button>
        )
        return tooltip && !open ? <Tooltip label={tooltip}>{button}</Tooltip> : button
      })()}
      {open && (
        <div
          className={clsx(
            "absolute top-full z-40 mt-1 flex min-w-44 flex-col rounded-xl border border-line bg-card p-1 text-[13px] text-ink shadow-pop",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  selected,
  icon,
  onClick,
  children,
}: {
  selected?: boolean
  icon?: React.ReactNode
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-hover [&>svg]:size-3.5 [&>svg]:shrink-0"
    >
      {icon}
      <span className="flex-1 truncate">{children}</span>
      {selected && <Check className="text-accent" />}
    </button>
  )
}
