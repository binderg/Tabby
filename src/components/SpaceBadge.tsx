import clsx from "clsx"
import { useCell } from "tinybase/ui-react"

/** A space's first letter on its color, as the sidebar and the popup show it. */
export function SpaceBadge({ id, className = "size-4 text-[9px]" }: { id: string; className?: string }) {
  const name = useCell("spaces", id, "name") as string
  const color = useCell("spaces", id, "color") as string
  return (
    <span className={clsx("grid shrink-0 place-items-center rounded font-bold text-white", `space-${color}`, className)}>
      {(name || "?")[0]!.toUpperCase()}
    </span>
  )
}
