import { useMemo, useState } from "react"
import clsx from "clsx"
import { ChevronsDownUp, ChevronsUpDown, Plus } from "lucide-react"
import { useCell, useSliceRowIds, useTable, useValue } from "tinybase/ui-react"

import { Collection } from "./Collection"
import { InlineName } from "./InlineName"
import { addCollection, store } from "@/lib/store"

export function SpaceView({ query }: { query: string }) {
  const spaceId = useValue("activeSpace") as string
  const name = useCell("spaces", spaceId, "name") as string
  const color = useCell("spaces", spaceId, "color") as string
  const collections = useSliceRowIds("bySpace", spaceId)
  const links = useTable("links")
  const [justMade, setJustMade] = useState<string | null>(null)

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
    <main className="my-3 flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-panel shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
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
            <button onClick={() => setAllCollapsed(false)} className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-hover">
              <ChevronsUpDown className="size-3.5" /> Expand all
            </button>
            <button onClick={() => setAllCollapsed(true)} className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-hover">
              <ChevronsDownUp className="size-3.5" /> Collapse all
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
        ) : collections.length === 0 ? (
          <p className="p-10 text-center text-ink-2">
            No collections yet. Make one, or drag a tab from the right onto the button above.
          </p>
        ) : (
          collections.map((c) => <Collection key={c} id={c} startEditing={c === justMade} />)
        )}
      </div>
    </main>
  )
}

function SearchResults({ matches }: { matches: Set<string> }) {
  const withHits = [...new Set([...matches].map((l) => store.getCell("links", l, "collectionId") as string))]
  if (withHits.length === 0) return <p className="p-10 text-center text-ink-2">Nothing found.</p>
  return withHits.map((c) => <Collection key={c} id={c} visible={matches} />)
}
