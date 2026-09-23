import { useState } from "react"
import clsx from "clsx"
import { Pencil, X } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useCell } from "tinybase/ui-react"

import { EditLinkModal } from "./EditLinkModal"
import { faviconUrl } from "@/lib/favicon"
import { store } from "@/lib/store"

export function LinkCard({ id, collectionId }: { id: string; collectionId: string }) {
  const url = useCell("links", id, "url") as string
  const title = useCell("links", id, "title") as string
  const description = useCell("links", id, "description") as string
  const [editing, setEditing] = useState(false)
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: `link:${id}`,
    data: { type: "link", id, collectionId },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={clsx("group relative", isDragging && "opacity-40")}
    >
      <CardBody url={url} title={title} description={description} />
      <div className="absolute top-1.5 right-1.5 hidden flex-col gap-0.5 group-hover:flex">
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

/** The card itself, shared with the drag overlay. */
export function CardBody({ url, title, description }: { url: string; title: string; description?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      draggable={false}
      title={url}
      className="flex h-[92px] w-full flex-col overflow-hidden rounded-xl bg-card shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_2px_10px_rgba(0,0,0,0.1)]"
    >
      <span className="flex min-w-0 flex-1 items-center gap-2 px-3 pr-7">
        <img src={faviconUrl(url)} alt="" className="size-4 shrink-0" />
        <span className="truncate font-medium">{title || url}</span>
      </span>
      <span className="truncate border-t border-line px-3 py-2 text-xs text-ink-2">{description || " "}</span>
    </a>
  )
}
