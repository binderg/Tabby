import clsx from "clsx"

import { Tooltip } from "./Tooltip"

/** An icon with a tooltip, as used on collection headers and in the popup. */
export function IconButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={clsx(
          "rounded-md p-1.5 hover:bg-hover hover:text-ink disabled:hover:bg-transparent [&>svg]:size-[18px]",
          className,
        )}
      >
        {children}
      </button>
    </Tooltip>
  )
}
