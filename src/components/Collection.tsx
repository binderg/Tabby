import clsx from "clsx"
import { AppWindow, Ban, ChevronDown, ExternalLink, GripVertical, Import, Palette, Plus, SquareX, Star, Tag, Trash2, X } from "lucide-react"
import { rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useCell, useSliceRowIds, useTable, useValue } from "tinybase/ui-react"

import { Dropdown, MenuItem } from "./Dropdown"
import { InlineName } from "./InlineName"
import { Tooltip } from "./Tooltip"
import { LinkCard } from "./LinkCard"
import { closeOpenTabsOf, saveWindowInto } from "@/lib/tabs"
import { addTag, collectionTags, COLORS, deleteCollection, deleteTag, store, toggleTag, type View } from "@/lib/store"

const GRIDS: Record<View, string> = {
  card: "grid grid-cols-[repeat(auto-fill,13rem)] gap-3",
  compact: "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2",
  list: "flex flex-col gap-1",
  grid: "grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-3",
}
const EMPTY_HEIGHT: Record<View, string> = { card: "h-[6.2rem]", compact: "h-10", list: "h-9", grid: "h-[104px]" }

/** `draggable` is off in search results, where a collection sits outside its space. */
export function Collection({
  id,
  startEditing,
  visible,
  draggable = true,
}: {
  id: string
  startEditing?: boolean
  visible?: Set<string>
  draggable?: boolean
}) {
  const name = useCell("collections", id, "name") as string
  const collapsed = useCell("collections", id, "collapsed") as boolean
  const starred = useCell("collections", id, "starred") as boolean
  const color = useCell("collections", id, "color") as string
  const spaceId = useCell("collections", id, "spaceId") as string
  useCell("collections", id, "tags") // re-render when tags change
  const tagRows = useTable("tags")
  const tags = collectionTags(id).filter((t) => tagRows[t])
  const view = useValue("view") as View
  const all = useSliceRowIds("byCollection", id)
  const links = visible ? all.filter((l) => visible.has(l)) : all
  // one sortable for the whole section: dragged by its handle, and the drop target for tabs and cards
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging, isOver, active } =
    useSortable({
      id: `col:${id}`,
      data: { type: "collection", id, spaceId },
      disabled: { draggable: !draggable, droppable: false },
    })
  const cardOver = isOver && active?.data.current?.type !== "collection"

  const urls = () => all.map((l) => store.getCell("links", l, "url") as string)

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={clsx(
        "group/col relative border-b border-line px-6 py-4",
        cardOver ? "bg-panel-hi" : color && `tint-${color}`,
        isDragging && "z-10 opacity-60",
      )}
    >
      <header className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1">
        {draggable && (
          <div className="absolute top-[19px] left-1 opacity-0 group-hover/col:opacity-100">
            <Tooltip label="Drag to reorder, or onto a space to move it">
              <button
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
                aria-label="Drag collection"
                className="cursor-grab rounded p-0.5 text-ink-3 hover:bg-hover hover:text-ink"
              >
                <GripVertical className="size-5" />
              </button>
            </Tooltip>
          </div>
        )}
        <InlineName
          value={name}
          placeholder="Untitled collection"
          startEditing={startEditing}
          onChange={(v) => store.setCell("collections", id, "name", v)}
          className="text-lg"
        />
        <IconButton
          label={collapsed ? "Expand" : "Collapse"}
          onClick={() => store.setCell("collections", id, "collapsed", !collapsed)}
          className="text-ink-3"
        >
          <ChevronDown className={clsx("transition-transform", collapsed && "-rotate-90")} />
        </IconButton>
        <IconButton
          label={starred ? "Unstar" : "Star"}
          onClick={() => store.setCell("collections", id, "starred", !starred)}
          className={starred ? "text-amber-500" : "text-ink-3 opacity-0 group-hover/col:opacity-100"}
        >
          <Star fill={starred ? "currentColor" : "none"} />
        </IconButton>
        {tags.map((t) => (
          <span
            key={t}
            className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium text-white", `space-${tagRows[t]!.color}`)}
          >
            {tagRows[t]!.name as string}
          </span>
        ))}
        <div className="text-ink-3 opacity-0 group-hover/col:opacity-100 has-[div.absolute]:opacity-100">
          <TagPicker collectionId={id} selected={tags} />
        </div>

        <div className="ml-auto flex items-center gap-1 text-ink-3 opacity-0 transition-opacity group-hover/col:opacity-100 has-[div.absolute]:opacity-100">
          <ColorPicker collectionId={id} current={color} />
          <IconButton label="Open all in tabs" onClick={() => urls().forEach((url) => chrome.tabs.create({ url, active: false }))}>
            <ExternalLink />
          </IconButton>
          <IconButton label="Open all in a new window" onClick={() => chrome.windows.create({ url: urls() })}>
            <AppWindow />
          </IconButton>
          <IconButton label="Save this window's tabs into this collection" onClick={() => saveWindowInto(id)}>
            <Import />
          </IconButton>
          <IconButton label="Close open tabs that are in this collection" onClick={() => closeOpenTabsOf(id)}>
            <SquareX />
          </IconButton>
          <IconButton
            label="Delete collection"
            onClick={() => (all.length === 0 || confirm(`Delete "${name || "Untitled"}" and its ${all.length} tabs?`)) && deleteCollection(id)}
          >
            <Trash2 />
          </IconButton>
        </div>
      </header>
      <p className="mt-0.5 mb-3 text-[13px] text-ink-2">
        {all.length} {all.length === 1 ? "tab" : "tabs"}
      </p>

      {!collapsed && (
        <SortableContext items={links.map((l) => `link:${l}`)} strategy={rectSortingStrategy}>
          <div className={GRIDS[view]}>
            {links.map((l) => (
              <LinkCard key={l} id={l} collectionId={id} view={view} />
            ))}
            {links.length === 0 && (
              <div className={clsx("grid place-items-center rounded-xl border border-dashed border-line text-xs text-ink-3", EMPTY_HEIGHT[view])}>
                Drag tabs here
              </div>
            )}
          </div>
        </SortableContext>
      )}
    </section>
  )
}

/** A header icon with a tooltip. Sized to match the big dropdown icons. */
function IconButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        aria-label={label}
        className={clsx("rounded-md p-1.5 hover:bg-hover hover:text-ink [&>svg]:size-[18px]", className)}
      >
        {children}
      </button>
    </Tooltip>
  )
}
function TagPicker({ collectionId, selected }: { collectionId: string; selected: string[] }) {
  const tags = useTable("tags")
  return (
    <Dropdown icon={<Tag />} label="" chevron={false} big tooltip="Tags">
      {() => (
        <>
          {Object.entries(tags).map(([t, row]) => (
            <div key={t} className="group/tag flex items-center">
              <MenuItem
                selected={selected.includes(t)}
                icon={<span className={clsx("size-2.5 rounded-full", `space-${row.color}`)} />}
                onClick={() => toggleTag(collectionId, t)}
              >
                {row.name as string}
              </MenuItem>
              <button
                onClick={() => confirm(`Delete the tag "${row.name}" everywhere?`) && deleteTag(t)}
                className="invisible rounded p-1 text-ink-3 group-hover/tag:visible hover:text-ink"
                title="Delete tag"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          <form
            className="mt-1 flex items-center gap-1.5 border-t border-line px-2.5 pt-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              const input = e.currentTarget.elements.namedItem("tag") as HTMLInputElement
              const name = input.value.trim()
              if (!name) return
              toggleTag(collectionId, addTag(name))
              input.value = ""
            }}
          >
            <Plus className="size-3.5 text-ink-3" />
            <input name="tag" placeholder="New tag" className="min-w-0 flex-1 bg-transparent py-1 outline-none" />
          </form>
        </>
      )}
    </Dropdown>
  )
}
function ColorPicker({ collectionId, current }: { collectionId: string; current: string }) {
  const set = (c: string) => store.setCell("collections", collectionId, "color", c)
  return (
    <Dropdown icon={<Palette />} label="" chevron={false} big tooltip="Background color" align="right">
      {(close) => (
        <div className="flex items-center gap-1.5 p-1.5">
          <button
            onClick={() => (set(""), close())}
            title="No color"
            className={clsx(
              "grid size-6 place-items-center rounded-full border border-line bg-panel text-ink-3",
              !current && "outline-2 outline-offset-1 outline-accent",
            )}
          >
            <Ban className="size-3.5" />
          </button>
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => (set(c), close())}
              title={c}
              className={clsx(
                "size-6 rounded-full",
                `space-${c}`,
                current === c && "outline-2 outline-offset-1 outline-accent",
              )}
            />
          ))}
        </div>
      )}
    </Dropdown>
  )
}