/* The toolbar popup: save the page you are on, or the whole window (a
   session), into a collection without leaving it. Pick a space, then use the
   buttons on a collection, or search. */
import { useEffect, useRef, useState } from "react"
import clsx from "clsx"
import { Check, ChevronLeft, ChevronRight, CircleMinus, CirclePlus, Download, ExternalLink, Plus } from "lucide-react"
import { useCell, useSliceRowIds, useSortedRowIds, useTable } from "tinybase/ui-react"

import { IconButton } from "./IconButton"
import { SearchField } from "./SearchField"
import { SpaceBadge } from "./SpaceBadge"
import { faviconUrl } from "@/lib/favicon"
import { addCollection, addLinks, removeUrl, store, useStoreReady, type LinkFields } from "@/lib/store"
import { openTabby, saveable } from "@/lib/tabs"
import logo from "@/assets/logo.png"

/** "tab" is the page you are on, "session" every page in this window. */
type What = "tab" | "session"

type Saver = {
  tab?: LinkFields
  session: LinkFields[]
  /** whether a collection already holds everything `what` would add */
  has: (collectionId: string, what: What) => boolean
  save: (collectionId: string, what: What) => void
  /** take the current tab out of a collection */
  remove: (collectionId: string) => void
}

function useWindowTabs() {
  const [tabs, setTabs] = useState<{ tab?: LinkFields; session: LinkFields[] }>({ session: [] })
  useEffect(() => {
    chrome.tabs.query({ currentWindow: true }).then((got) => {
      const fields = (t: chrome.tabs.Tab) => ({ url: t.url!, title: t.title ?? t.url! })
      const active = got.find((t) => t.active)
      setTabs({
        tab: active && saveable(active) ? fields(active) : undefined,
        session: got.filter(saveable).map(fields),
      })
    })
  }, [])
  return tabs
}

export function Popup() {
  const ready = useStoreReady()
  const { tab, session } = useWindowTabs()
  const [spaceId, setSpaceId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [toast, setToast] = useState("")
  const toastTimer = useRef<number>(undefined)
  const search = useRef<HTMLInputElement>(null)
  const links = useTable("links")

  useEffect(() => {
    if (ready) search.current?.focus()
  }, [ready])

  if (!ready) return null

  const urlsOf = new Map<string, Set<string>>()
  for (const l of Object.values(links)) {
    const c = l.collectionId as string
    if (!urlsOf.has(c)) urlsOf.set(c, new Set())
    urlsOf.get(c)!.add(l.url as string)
  }
  const say = (message: string) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(""), 2500)
  }
  const pages = (what: What) => (what === "tab" ? (tab ? [tab] : []) : session)

  const saver: Saver = {
    tab,
    session,
    has: (c, what) => {
      const urls = urlsOf.get(c)
      return !!urls && pages(what).length > 0 && pages(what).every((p) => urls.has(p.url))
    },
    save: (c, what) => {
      const add = pages(what)
      if (!add.length) return
      addLinks(c, add)
      const name = (store.getCell("collections", c, "name") as string) || "Untitled collection"
      say(what === "tab" ? `Saved to ${name}` : `Saved ${add.length} tabs to ${name}`)
    },
    remove: (c) => {
      if (!tab) return
      removeUrl(c, tab.url)
      say(`Removed from ${(store.getCell("collections", c, "name") as string) || "Untitled collection"}`)
    },
  }

  return (
    <div className="flex h-[560px] w-[560px] flex-col gap-3 px-4 py-4 text-[15px]">
      <header className="flex items-center gap-2 px-2">
        <img src={logo} alt="" className="-my-1.5 size-10" />
        <span className="text-[17px] font-semibold">Tabby</span>
        <button
          onClick={() => openTabby().then(() => window.close())}
          className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-accent hover:bg-hover"
        >
          Open Tabby <ExternalLink className="size-3.5" />
        </button>
      </header>

      <CurrentTab tab={tab} />

      <SearchField ref={search} value={query} onChange={setQuery} placeholder="Search collections and spaces" />

      <nav className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1">
        {query.trim() ? (
          <Results query={query.trim()} saver={saver} onSpace={(s) => (setSpaceId(s), setQuery(""))} />
        ) : spaceId && store.hasRow("spaces", spaceId) ? (
          <SpaceCollections spaceId={spaceId} saver={saver} onBack={() => setSpaceId(null)} />
        ) : (
          <Spaces onPick={setSpaceId} />
        )}
      </nav>

      {toast && (
        <p className="flex items-center gap-2 rounded-md bg-card px-2 py-1.5 text-[13px] text-ink shadow-card">
          <Check className="size-3.5 text-accent" /> {toast}
        </p>
      )}
    </div>
  )
}

/** The page the add tab buttons will save, so there is no guessing. */
function CurrentTab({ tab }: { tab?: LinkFields }) {
  const box = "flex items-center gap-2.5 rounded-lg bg-card px-3 py-2 shadow-card"
  if (!tab) return <div className={clsx(box, "text-ink-2")}>This page can't be saved, but the rest of the window can</div>
  return (
    <div className={box}>
      <img src={faviconUrl(tab.url)} alt="" className="size-4 shrink-0" />
      <div className="min-w-0">
        <p className="truncate font-medium">{tab.title}</p>
        <p className="truncate text-[13px] text-ink-3">{new URL(tab.url).hostname}</p>
      </div>
    </div>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 mb-1 px-2 text-[13px] text-ink-2">{children}</p>
}

/** a list row, styled like a space in the sidebar */
const row = "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover"

function Spaces({ onPick }: { onPick: (id: string) => void }) {
  const spaces = useSortedRowIds("spaces", "order")
  const rows = useTable("spaces")
  const cols = useTable("collections")
  // pinned first, the way the sidebar shows them
  const ordered = [...spaces.filter((s) => rows[s]?.pinned), ...spaces.filter((s) => !rows[s]?.pinned)]
  return (
    <>
      <Heading>Spaces</Heading>
      {ordered.map((id) => (
        <button key={id} onClick={() => onPick(id)} className={clsx(row, "group")}>
          <SpaceBadge id={id} className="size-5 text-[11px]" />
          <span className={clsx("flex-1 truncate", rows[id]?.pinned && "font-semibold")}>
            {(rows[id]?.name as string) || "Untitled space"}
          </span>
          <span className="text-[13px] text-ink-3">{Object.values(cols).filter((c) => c.spaceId === id).length}</span>
          <ChevronRight className="size-4 text-ink-3 group-hover:text-ink" />
        </button>
      ))}
    </>
  )
}

function SpaceCollections({ spaceId, saver, onBack }: { spaceId: string; saver: Saver; onBack: () => void }) {
  const name = useCell("spaces", spaceId, "name") as string
  const ids = useSortedRowIds("collections", "order").filter((c) => store.getCell("collections", c, "spaceId") === spaceId)
  // what the new collection being named will get
  const [naming, setNaming] = useState<What | null>(null)
  const [draft, setDraft] = useState("")

  return (
    <>
      <div className="sticky top-0 z-10 flex items-center gap-1 bg-page pb-1 text-ink-2">
        <IconButton label="All spaces" onClick={onBack}>
          <ChevronLeft />
        </IconButton>
        <SpaceBadge id={spaceId} className="size-5 text-[11px]" />
        <span className="ml-1 flex-1 truncate font-medium text-ink">{name || "Untitled space"}</span>
        <IconButton
          label="Save session to a new collection"
          disabled={!saver.session.length}
          onClick={() => setNaming("session")}
          className="disabled:opacity-40"
        >
          <Download />
        </IconButton>
        <IconButton
          label="Save tab to a new collection"
          disabled={!saver.tab}
          onClick={() => setNaming("tab")}
          className="text-accent disabled:opacity-40"
        >
          <Plus />
        </IconButton>
      </div>

      {naming && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            saver.save(addCollection(spaceId, draft.trim() || "New collection"), naming)
            setNaming(null)
            setDraft("")
          }}
          className={clsx(row, "bg-card hover:bg-card")}
        >
          {naming === "tab" ? <Plus className="size-4 text-accent" /> : <Download className="size-4 text-accent" />}
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && (e.preventDefault(), setNaming(null))}
            onBlur={() => !draft && setNaming(null)}
            placeholder={naming === "tab" ? "Name the new collection, then Enter" : "Name the new session collection, then Enter"}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-3"
          />
        </form>
      )}

      {ids.map((id) => (
        <CollectionRow key={id} id={id} saver={saver} />
      ))}
      {ids.length === 0 && !naming && <p className="px-2 py-6 text-center text-ink-3">No collections in this space yet</p>}
    </>
  )
}

function CollectionRow({ id, saver, showSpace = false }: { id: string; saver: Saver; showSpace?: boolean }) {
  const name = useCell("collections", id, "name") as string
  const spaceId = useCell("collections", id, "spaceId") as string
  const spaceName = useCell("spaces", spaceId, "name") as string
  const count = useSliceRowIds("byCollection", id).length
  const hasTab = saver.has(id, "tab")
  const hasSession = saver.has(id, "session")

  return (
    <div className={clsx(row, "group py-1")}>
      <span className="min-w-0 flex-1">
        <span className="block truncate">
          {name || "Untitled collection"}
          <span className="ml-2 text-[13px] text-ink-3">{count === 1 ? "1 tab" : `${count} tabs`}</span>
        </span>
        {showSpace && <span className="block truncate text-[13px] text-ink-3">{spaceName || "Untitled space"}</span>}
      </span>
      <span className="flex items-center text-ink-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
        <IconButton
          label={hasSession ? "Every tab in this window is already here" : "Save session to this collection"}
          disabled={!saver.session.length || hasSession}
          onClick={() => saver.save(id, "session")}
          className="disabled:opacity-40"
        >
          <Download />
        </IconButton>
      </span>
      {/* once the tab is here, the button takes it out again, and stays in view so you can see it's saved */}
      {hasTab ? (
        <IconButton label="Remove tab from this collection" onClick={() => saver.remove(id)} className="text-ink-2">
          <CircleMinus />
        </IconButton>
      ) : (
        <span className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          <IconButton
            label="Add tab to this collection"
            disabled={!saver.tab}
            onClick={() => saver.save(id, "tab")}
            className="text-accent disabled:opacity-40"
          >
            <CirclePlus />
          </IconButton>
        </span>
      )}
    </div>
  )
}

function Results({ query, saver, onSpace }: { query: string; saver: Saver; onSpace: (id: string) => void }) {
  const q = query.toLowerCase()
  const spaces = useTable("spaces")
  const cols = useTable("collections")
  const matchSpaces = useSortedRowIds("spaces", "order").filter((s) => String(spaces[s]?.name ?? "").toLowerCase().includes(q))
  const matchCols = useSortedRowIds("collections", "name").filter((c) => String(cols[c]?.name ?? "").toLowerCase().includes(q))

  if (!matchSpaces.length && !matchCols.length) {
    return <p className="px-2 py-6 text-center text-ink-3">Nothing called "{query}"</p>
  }
  return (
    <>
      {matchCols.length > 0 && <Heading>Collections</Heading>}
      {matchCols.map((id) => (
        <CollectionRow key={id} id={id} saver={saver} showSpace />
      ))}
      {matchSpaces.length > 0 && <Heading>Spaces</Heading>}
      {matchSpaces.map((id) => (
        <button key={id} onClick={() => onSpace(id)} className={clsx(row, "group")}>
          <SpaceBadge id={id} className="size-5 text-[11px]" />
          <span className="flex-1 truncate">{(spaces[id]?.name as string) || "Untitled space"}</span>
          <ChevronRight className="size-4 text-ink-3 group-hover:text-ink" />
        </button>
      ))}
    </>
  )
}
