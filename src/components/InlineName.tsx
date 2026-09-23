import { useEffect, useRef, useState } from "react"
import clsx from "clsx"

/** Text that becomes an input on double click (or when `editing` is forced on). */
export function InlineName({
  value,
  onChange,
  className,
  placeholder,
  startEditing = false,
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
  startEditing?: boolean
}) {
  const [editing, setEditing] = useState(startEditing)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setDraft(value)
      ref.current?.select()
    }
  }, [editing])

  if (!editing) {
    return (
      <span
        className={clsx("cursor-text truncate", !value && "text-ink-3", className)}
        onDoubleClick={() => setEditing(true)}
        title="Double click to rename"
      >
        {value || placeholder}
      </span>
    )
  }

  const commit = () => {
    setEditing(false)
    if (draft.trim() !== value) onChange(draft.trim())
  }

  return (
    <input
      ref={ref}
      autoFocus
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit()
        if (e.key === "Escape") setEditing(false)
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={clsx("min-w-0 rounded bg-card px-1 outline-2 outline-accent", className)}
    />
  )
}
