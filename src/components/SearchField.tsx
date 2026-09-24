import clsx from "clsx"
import { Search } from "lucide-react"

/** The search box, as the sidebar and the popup show it. Escape clears it. */
export function SearchField({
  value,
  onChange,
  placeholder = "Search",
  ref,
  className,
  children,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  ref?: React.Ref<HTMLInputElement>
  className?: string
  /** shown at the end, like a shortcut hint */
  children?: React.ReactNode
}) {
  return (
    <label
      className={clsx(
        "flex items-center gap-2 rounded-lg border border-line bg-card px-2.5 py-1.5 text-ink-2 focus-within:outline-2 focus-within:outline-accent",
        className,
      )}
    >
      <Search className="size-3.5" />
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault() // in the popup, Escape would otherwise close it
            onChange("")
          }
        }}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-2"
      />
      {children}
    </label>
  )
}
