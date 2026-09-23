import clsx from "clsx"
import { AppWindow, ChevronDown, ExternalLink, Trash2 } from "lucide-react"
import { useDroppable } from "@dnd-kit/core"
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable"
import { useCell, useSliceRowIds } from "tinybase/ui-react"

import { InlineName } from "./InlineName"
import { LinkCard } from "./LinkCard"
import { deleteCollection, store } from "@/lib/store"

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(164px,1fr))] gap-3"

export function Collection({ id, startEditing, visible }: { id: string; startEditing?: boolean; visible?: Set<string> }) {
  const name = useCell("collections", id, "name") as string
  const collapsed = useCell("collections", id, "collapsed") as boolean
  const all = useSliceRowIds("byCollection", id)
  const links = visible ? all.filter((l) => visible.has(l)) : all
  const { setNodeRef, isOver } = useDroppable({ id: `col:${id}`, data: { type: "collection", id } })

  const urls = () => all.map((l) => store.getCell("links", l, "url") as string)

  return (
    <section
      ref={setNodeRef}
      className={clsx("group/col border-b border-line px-6 py-4 transition-colors", isOver && "bg-panel-hi")}
    >
      <header className="flex items-center gap-1.5">
        <InlineName
          value={name}
          placeholder="Untitled collection"
          startEditing={startEditing}
          onChange={(v) => store.setCell("collections", id, "name", v)}
          className="text-[15px]"
        />
        <button
          onClick={() => store.setCell("collections", id, "collapsed", !collapsed)}
          className="rounded p-0.5 text-ink-3 hover:bg-hover hover:text-ink"
          title={collapsed ? "Expand" : "Collapse"}
        >
          <ChevronDown className={clsx("size-3.5 transition-transform", collapsed && "-rotate-90")} />
        </button>

        <div className="ml-auto flex items-center gap-1 text-ink-3 opacity-0 transition-opacity group-hover/col:opacity-100">
          <IconButton title="Open all in tabs" onClick={() => urls().forEach((url) => chrome.tabs.create({ url, active: false }))}>
            <ExternalLink />
          </IconButton>
          <IconButton title="Open all in a new window" onClick={() => chrome.windows.create({ url: urls() })}>
            <AppWindow />
          </IconButton>
          <IconButton
            title="Delete collection"
            onClick={() => (all.length === 0 || confirm(`Delete "${name || "Untitled"}" and its ${all.length} tabs?`)) && deleteCollection(id)}
          >
            <Trash2 />
          </IconButton>
        </div>
      </header>
      <p className="mt-0.5 mb-3 text-xs text-ink-2">
        {all.length} {all.length === 1 ? "tab" : "tabs"}
      </p>

      {!collapsed && (
        <SortableContext items={links.map((l) => `link:${l}`)} strategy={rectSortingStrategy}>
          <div className={GRID}>
            {links.map((l) => (
              <LinkCard key={l} id={l} collectionId={id} />
            ))}
            {links.length === 0 && (
              <div className="grid h-[76px] place-items-center rounded-xl border border-dashed border-line text-xs text-ink-3">
                Drag tabs here
              </div>
            )}
          </div>
        </SortableContext>
      )}
    </section>
  )
}

function IconButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} className="rounded p-1 hover:bg-hover hover:text-ink [&>svg]:size-3.5">
      {children}
    </button>
  )
}
