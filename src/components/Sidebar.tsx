import { useEffect, useRef, useState } from "react"
import clsx from "clsx"
import { Download, Pin, PinOff, Plus, Search, Trash2, Upload } from "lucide-react"
import { useDroppable } from "@dnd-kit/core"
import { useCell, useSortedRowIds, useTable, useValue } from "tinybase/ui-react"

import { InlineName } from "./InlineName"
import { Tooltip } from "./Tooltip"
import { addSpace, COLORS, deleteSpace, store } from "@/lib/store"
import { exportJson, importJson } from "@/lib/transfer"
import icon from "@/assets/icon.svg"

export function Sidebar({ query, setQuery }: { query: string; setQuery: (q: string) => void }) {
  const spaces = useSortedRowIds("spaces", "order")
  const rows = useTable("spaces")
  // pinned spaces first, each group keeping its own order
  const pinned = spaces.filter((s) => rows[s]?.pinned)
  const rest = spaces.filter((s) => !rows[s]?.pinned)
  const active = useValue("activeSpace") as string
  const [justMade, setJustMade] = useState<string | null>(null)
  const search = useRef<HTMLInputElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const [toast, setToast] = useState("")

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === "/" && t.tagName !== "INPUT" && t.tagName !== "TEXTAREA") {
        e.preventDefault()
        search.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const createSpace = () => {
    const id = addSpace("", COLORS[spaces.length % COLORS.length]!)
    store.setValue("activeSpace", id)
    setJustMade(id)
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      setToast(importJson(await f.text()))
    } catch (err) {
      setToast(`Import failed: ${(err as Error).message}`)
    }
    if (file.current) file.current.value = ""
    setTimeout(() => setToast(""), 4000)
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-4 px-3 py-5">
      <div className="flex items-center gap-2 px-2">
        <img src={icon} alt="" className="size-7" />
        <span className="text-[15px] font-semibold">Tabby</span>
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-line bg-card px-2.5 py-1.5 text-ink-2 focus-within:outline-2 focus-within:outline-accent">
        <Search className="size-3.5" />
        <input
          ref={search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setQuery("")}
          placeholder="Search"
          className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-2"
        />
        <kbd className="rounded border border-line px-1 text-[10px] text-ink-3">/</kbd>
      </label>

      <nav className="flex flex-col gap-0.5">
        <div className="mb-1 flex items-center justify-between px-2 text-xs text-ink-2">
          <span>Spaces</span>
          <button onClick={createSpace} className="rounded p-0.5 hover:bg-hover" title="New space">
            <Plus className="size-3.5" />
          </button>
        </div>
        {[pinned, rest].map((group, i) => (
          <div key={i} className={clsx("flex flex-col gap-0.5", i === 1 && pinned.length > 0 && "mt-1 border-t border-line pt-1.5")}>
            {group.map((id) => (
              <SpaceItem
                key={id}
                id={id}
                active={id === active}
                startEditing={id === justMade}
                onEdited={() => setJustMade(null)}
              />
            ))}
          </div>
        ))}
        <button
          onClick={createSpace}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-ink-2 hover:bg-hover"
        >
          <Plus className="size-3.5" /> Create Space
        </button>
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 text-ink-2">
        {toast && <p className="mb-2 rounded-md bg-card px-2 py-1.5 text-xs text-ink">{toast}</p>}
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <button
          onClick={() => file.current?.click()}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover"
          title="Import a Tabby backup or a Toby export"
        >
          <Upload className="size-3.5" /> Import (Tabby or Toby)
        </button>
        <button onClick={exportJson} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover">
          <Download className="size-3.5" /> Export backup
        </button>
      </div>
    </aside>
  )
}

function SpaceItem({
  id,
  active,
  startEditing,
  onEdited,
}: {
  id: string
  active: boolean
  startEditing: boolean
  onEdited: () => void
}) {
  const name = useCell("spaces", id, "name") as string
  const color = useCell("spaces", id, "color") as string
  const pinned = useCell("spaces", id, "pinned") as boolean
  // a collection dragged here moves into this space
  const { setNodeRef, isOver } = useDroppable({ id: `space:${id}`, data: { type: "space", id } })

  return (
    <div
      ref={setNodeRef}
      onClick={() => store.setValue("activeSpace", id)}
      className={clsx(
        "group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5",
        isOver ? "bg-panel-hi outline-2 outline-accent" : active ? "bg-hover font-medium" : "hover:bg-hover",
        pinned && "font-semibold",
      )}
    >
      <span className={clsx("grid size-4 shrink-0 place-items-center rounded text-[9px] font-bold text-white", `space-${color}`)}>
        {(name || "?")[0]!.toUpperCase()}
      </span>
      <InlineName
        value={name}
        placeholder="Untitled space"
        startEditing={startEditing}
        onChange={(v) => {
          store.setCell("spaces", id, "name", v)
          onEdited()
        }}
        className="flex-1"
      />
      <SpaceButton
        label={pinned ? "Unpin" : "Pin to top"}
        onClick={() => store.setCell("spaces", id, "pinned", !pinned)}
      >
        {pinned ? <PinOff /> : <Pin />}
      </SpaceButton>
      <SpaceButton
        label="Delete space"
        onClick={() => confirm(`Delete the space "${name || "Untitled"}" and everything in it?`) && deleteSpace(id)}
      >
        <Trash2 />
      </SpaceButton>
    </div>
  )
}

function SpaceButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip label={label}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        aria-label={label}
        className="invisible rounded p-0.5 text-ink-3 group-hover:visible hover:text-ink [&>svg]:size-3.5"
      >
        {children}
      </button>
    </Tooltip>
  )
}