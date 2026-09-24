import { useState } from "react"
import clsx from "clsx"
import { Pencil, X } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useCell } from "tinybase/ui-react"

import { EditLinkModal } from "./EditLinkModal"
import { faviconUrl } from "@/lib/favicon"
import { store, type View } from "@/lib/store"

export function LinkCard({ id, collectionId, view }: { id: string; collectionId: string; view: View }) {
  const url = useCell("links", id, "url") as string
  const title = useCell("links", id, "title") as string
  const description = useCell("links", id, "description") as string
  const [editing, setEditing] = useState(false)
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: `link:${id}`,
    data: { type: "link", id, collectionId },
  })
  // stacked in the corner on the tall views, side by side on the thin ones
  const inRow = view === "compact" || view === "list"

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={clsx("group relative", isDragging && "opacity-40")}
    >
      <CardBody url={url} title={title} description={description} view={view} />
      <div
        className={clsx(
          "absolute right-1.5 hidden gap-0.5 group-hover:flex",
          inRow ? "top-1/2 -translate-y-1/2 flex-row-reverse" : "top-1.5 flex-col",
        )}
      >
        <CardButton title="Remove" onClick={() => store.delRow("links", id)}>
          <X />
        </CardButton>
        <CardButton title="Edit" onClick={() => setEditing(true)}>
          <Pencil />
        </CardButton>
      </div>
      {editing && <EditLinkModal id={id} onClose={() => setEditing(false)} />}
    </div>
  )
}

function CardButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className="grid size-5 place-items-center rounded bg-card text-ink-3 shadow-sm hover:bg-hover hover:text-ink [&>svg]:size-3"
    >
      {children}
    </button>
  )
}

const SHADOW = "bg-card shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_2px_10px_rgba(0,0,0,0.1)]"

/** The card itself, in each view, shared with the drag overlay. */
export function CardBody({
  url,
  title,
  description,
  view = "card",
}: {
  url: string
  title: string
  description?: string
  view?: View
}) {
  const link = { href: url, target: "_blank", rel: "noreferrer", draggable: false, title: url }
  const icon = (size: string) => <img src={faviconUrl(url, 64)} alt="" className={clsx(size, "shrink-0")} />
  const name = <span className="truncate font-medium">{title || url}</span>

  if (view === "compact") {
    return (
      <a {...link} className={clsx("flex h-10 items-center gap-2 rounded-lg px-3 pr-14", SHADOW)}>
        {icon("size-4")}
        {name}
      </a>
    )
  }

  if (view === "list") {
    return (
      <a {...link} className={clsx("flex h-9 items-center gap-2 rounded-lg px-3 pr-14", SHADOW)}>
        {icon("size-4")}
        <span className="max-w-[45%] shrink-0 truncate font-medium">{title || url}</span>
        {description && description !== title && <span className="truncate text-ink-2">{description}</span>}
      </a>
    )
  }

  if (view === "grid") {
    return (
      <a {...link} className={clsx("flex h-[104px] flex-col items-center justify-center gap-2.5 rounded-xl px-2", SHADOW)}>
        {icon("size-8")}
        <span className="line-clamp-2 w-full text-center text-xs leading-tight font-medium break-words">{title || url}</span>
      </a>
    )
  }

  return (
    <a {...link} className={clsx("flex h-[6.2rem] w-full flex-col overflow-hidden rounded-xl", SHADOW)}>
      <span className="flex min-w-0 flex-1 items-center gap-2 px-3 pr-7">
        {icon("size-4")}
        {name}
      </span>
      <span className="truncate border-t border-line px-3 py-2 text-xs text-ink-2">{description || "\u00a0"}</span>
    </a>
  )
}