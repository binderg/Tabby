import { useMemo, useState } from "react"
import clsx from "clsx"
import { ArrowDownUp, ChevronsDownUp, ChevronsUpDown, LayoutGrid, List, Plus, Rows3, SquareStack, Tag } from "lucide-react"
import { useCell, useSliceRowIds, useTable, useValue } from "tinybase/ui-react"

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"

import { Collection } from "./Collection"
import { Dropdown, MenuItem } from "./Dropdown"
import { InlineName } from "./InlineName"
import { addCollection, collectionTags, sortCollections, SORTS, store, VIEWS, type Sort, type View } from "@/lib/store"

const VIEW_ICONS: Record<View, React.ReactNode> = {
  card: <SquareStack />,
  compact: <Rows3 />,
  list: <List />,
  grid: <LayoutGrid />,
}

export function SpaceView({ query }: { query: string }) {
  const spaceId = useValue("activeSpace") as string
  const name = useCell("spaces", spaceId, "name") as string
  const color = useCell("spaces", spaceId, "color") as string
  const collections = useSliceRowIds("bySpace", spaceId)
  const links = useTable("links")
  const tags = useTable("tags")
  useTable("collections") // re-sort when a name, star or tag changes
  const sort = useValue("sort") as Sort
  const view = useValue("view") as View
  const [picked, setTagFilter] = useState<Set<string>>(new Set())
  // a deleted tag drops out of the filter rather than hiding everything
  const tagFilter = new Set([...picked].filter((t) => tags[t]))
  const [justMade, setJustMade] = useState<string | null>(null)

  const shown = sortCollections(collections, sort).filter(
    (c) => tagFilter.size === 0 || collectionTags(c).some((t) => tagFilter.has(t)),
  )
  const toggleFilter = (t: string) => {
    const next = new Set(tagFilter)
    if (!next.delete(t)) next.add(t)
    setTagFilter(next)
  }

  const inSpace = useMemo(() => new Set(collections), [collections])
  const tabCount = Object.values(links).filter((l) => inSpace.has(l.collectionId as string)).length

  // Search runs across every space, and shows only the collections with a match.
  const q = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!q) return null
    const hit = new Set<string>()
    for (const [id, l] of Object.entries(links)) {
      if (`${l.title} ${l.url} ${l.description}`.toLowerCase().includes(q)) hit.add(id)
    }
    return hit
  }, [q, links])

  const setAllCollapsed = (collapsed: boolean) =>
    store.transaction(() => collections.forEach((c) => store.setCell("collections", c, "collapsed", collapsed)))

  return (
    <main className="my-3 flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-panel shadow-card">
      <header className="flex flex-col gap-3 border-b border-line px-6 pt-5 pb-3">
        {matches ? (
          <h1 className="text-xl">
            {matches.size} {matches.size === 1 ? "result" : "results"} for "{query.trim()}"
          </h1>
        ) : (
          <div className="flex items-center gap-3">
            <span className={clsx("size-4 rounded", `space-${color}`)} />
            <InlineName
              value={name}
              placeholder="Untitled space"
              onChange={(v) => store.setCell("spaces", spaceId, "name", v)}
              className="text-xl"
            />
            <span className="text-xs text-ink-2">
              {collections.length} {collections.length === 1 ? "Collection" : "Collections"}
            </span>
            <span className="text-xs text-ink-2">{tabCount} tabs</span>
          </div>
        )}
        {!matches && (
          <div className="flex items-center gap-1 text-xs text-ink-2">
            <Dropdown icon={<ArrowDownUp />} label={SORTS[sort]} active={sort !== "manual"}>
              {(close) =>
                (Object.keys(SORTS) as Sort[]).map((s) => (
                  <MenuItem key={s} selected={s === sort} onClick={() => (store.setValue("sort", s), close())}>
                    {SORTS[s]}
                  </MenuItem>
                ))
              }
            </Dropdown>
            <Dropdown
              icon={<Tag />}
              label={tagFilter.size ? `Tags (${tagFilter.size})` : "Tag Filter"}
              active={tagFilter.size > 0}
            >
              {() => (
                <>
                  {Object.keys(tags).length === 0 && (
                    <p className="px-2.5 py-1.5 text-xs text-ink-3">No tags yet. Tag a collection from its header.</p>
                  )}
                  {Object.entries(tags).map(([id, t]) => (
                    <MenuItem
                      key={id}
                      selected={tagFilter.has(id)}
                      icon={<span className={clsx("size-2.5 rounded-full", `space-${t.color}`)} />}
                      onClick={() => toggleFilter(id)}
                    >
                      {t.name as string}
                    </MenuItem>
                  ))}
                  {tagFilter.size > 0 && (
                    <MenuItem onClick={() => setTagFilter(new Set())}>
                      <span className="text-ink-2">Clear filter</span>
                    </MenuItem>
                  )}
                </>
              )}
            </Dropdown>
            <Dropdown icon={VIEW_ICONS[view]} label={VIEWS[view]}>
              {(close) =>
                (Object.keys(VIEWS) as View[]).map((v) => (
                  <MenuItem
                    key={v}
                    icon={VIEW_ICONS[v]}
                    selected={v === view}
                    onClick={() => (store.setValue("view", v), close())}
                  >
                    {VIEWS[v]}
                  </MenuItem>
                ))
              }
            </Dropdown>
            <span className="mx-1 h-4 w-px bg-line" />
            <button onClick={() => setAllCollapsed(false)} className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-hover">
              <ChevronsUpDown className="size-3.5" /> Expand
            </button>
            <button onClick={() => setAllCollapsed(true)} className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-hover">
              <ChevronsDownUp className="size-3.5" /> Collapse
            </button>
            <button
              onClick={() => setJustMade(addCollection(spaceId))}
              className="ml-auto flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 font-medium text-accent-ink hover:brightness-105"
            >
              <Plus className="size-3.5" /> New Collection
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {matches ? (
          <SearchResults matches={matches} />
        ) : shown.length === 0 && tagFilter.size > 0 ? (
          <p className="p-10 text-center text-ink-2">No collections with those tags.</p>
        ) : collections.length === 0 ? (
          <p className="p-10 text-center text-ink-2">
            No collections yet. Make one, or drag a tab from the right onto the button above.
          </p>
        ) : (
          <SortableContext items={shown.map((c) => `col:${c}`)} strategy={verticalListSortingStrategy}>
            {shown.map((c) => (
              <Collection key={c} id={c} startEditing={c === justMade} />
            ))}
          </SortableContext>
        )}
      </div>
    </main>
  )
}

function SearchResults({ matches }: { matches: Set<string> }) {
  const withHits = [...new Set([...matches].map((l) => store.getCell("links", l, "collectionId") as string))]
  if (withHits.length === 0) return <p className="p-10 text-center text-ink-2">Nothing found.</p>
  return (
    <SortableContext items={withHits.map((c) => `col:${c}`)}>
      {withHits.map((c) => (
        <Collection key={c} id={c} visible={matches} draggable={false} />
      ))}
    </SortableContext>
  )
}
