/* Where everything Tabby keeps lives.
 *
 * One TinyBase MergeableStore, persisted to chrome.storage.local. Mergeable
 * rather than a plain Store because every cell carries a timestamp from day
 * one, so a second device can later be attached with a TinyBase synchronizer
 * (WebSocket, Durable Object) and merge cleanly, with no migration of the data
 * people already have.
 *
 * chrome.storage.local rather than IndexedDB because its onChanged event fires
 * in every open new-tab page at once, so two tabs never disagree for longer
 * than a write.
 */
import { useEffect, useState } from "react"
import { createIndexes, createMergeableStore, type MergeableStore } from "tinybase"
import { createCustomPersister, type Persists } from "tinybase/persisters"

const KEY = "tabby"

export const SCHEMA = {
  spaces: {
    name: { type: "string", default: "" },
    color: { type: "string", default: "pink" },
    order: { type: "number", default: 0 },
    pinned: { type: "boolean", default: false },
  },
  collections: {
    spaceId: { type: "string", default: "" },
    name: { type: "string", default: "" },
    order: { type: "number", default: 0 },
    collapsed: { type: "boolean", default: false },
    starred: { type: "boolean", default: false },
    /** background tint, one of COLORS, or "" for none */
    color: { type: "string", default: "" },
    createdAt: { type: "number", default: 0 },
    /** tag ids, as a JSON array (cells hold scalars only) */
    tags: { type: "string", default: "[]" },
  },
  tags: {
    name: { type: "string", default: "" },
    color: { type: "string", default: "blue" },
  },
  links: {
    collectionId: { type: "string", default: "" },
    url: { type: "string", default: "" },
    title: { type: "string", default: "" },
    description: { type: "string", default: "" },
    order: { type: "number", default: 0 },
  },
} as const

export const VALUES_SCHEMA = {
  device: { type: "string", default: "" },
  activeSpace: { type: "string", default: "" },
  sort: { type: "string", default: "manual" },
  view: { type: "string", default: "card" },
} as const

export const SORTS = { manual: "Drag & Drop", alpha: "Alphabetical", starred: "Starred To Top", created: "Date Created" } as const
export type Sort = keyof typeof SORTS
export const VIEWS = { card: "Card", compact: "Compact", list: "List", grid: "Grid" } as const
export type View = keyof typeof VIEWS

export const COLORS = ["pink", "amber", "green", "blue", "purple", "slate"] as const
export type Color = (typeof COLORS)[number]

export const store: MergeableStore = createMergeableStore()
  .setTablesSchema(SCHEMA)
  .setValuesSchema(VALUES_SCHEMA) as MergeableStore

/** Collections per space and links per collection, each slice sorted by `order`. */
export const indexes = createIndexes(store)
  .setIndexDefinition("bySpace", "collections", "spaceId", "order")
  .setIndexDefinition("byCollection", "links", "collectionId", "order")

export const uid = () => crypto.randomUUID().replaceAll("-", "").slice(0, 16)

function chromeStoragePersister(s: MergeableStore) {
  return createCustomPersister(
    s,
    async () => {
      const got = await chrome.storage.local.get(KEY)
      return got[KEY] ? JSON.parse(got[KEY] as string) : undefined
    },
    async (getContent) => {
      await chrome.storage.local.set({ [KEY]: JSON.stringify(getContent()) })
    },
    (listener) => {
      /* Another page wrote. Hand its content over as *changes* (the trailing 1),
         so TinyBase merges it by timestamp. Handing it over as content would
         replace this page's store wholesale, and an older copy saved by another
         open tab could then undo a newer edit, like a deletion made here. */
      const onChanged = (changes: { [k: string]: chrome.storage.StorageChange }, area: string) => {
        if (area !== "local" || !(KEY in changes)) return
        const next = changes[KEY]!.newValue
        if (typeof next !== "string") return
        const [tables, values] = JSON.parse(next)
        listener(undefined, [tables, values, 1])
      }
      chrome.storage.onChanged.addListener(onChanged)
      return onChanged
    },
    (onChanged) => chrome.storage.onChanged.removeListener(onChanged),
    console.warn,
    3 as Persists.StoreOrMergeableStore, // a const enum, so named by value
  )
}

let opening: Promise<void> | null = null

function open(): Promise<void> {
  if (opening) return opening
  opening = (async () => {
    const persister = chromeStoragePersister(store)
    // in development, a hot reload of this file makes a new store; stop the old
    // one saving so it cannot write stale data over the new one's
    import.meta.hot?.dispose(() => persister.destroy())
    await persister.startAutoLoad()
    await persister.startAutoSave()

    if (!store.getValue("device")) store.setValue("device", uid())
    if (store.getRowCount("spaces") === 0) {
      const id = addSpace("Personal", "pink")
      store.setValue("activeSpace", id)
    }
    if (!store.hasRow("spaces", store.getValue("activeSpace") as string)) {
      store.setValue("activeSpace", sortedIds("spaces")[0] ?? "")
    }
  })()
  return opening
}

export function useStoreReady(): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let live = true
    open().then(() => live && setReady(true))
    return () => {
      live = false
    }
  }, [])
  return ready
}

/* ordering */

export function sortedIds(table: "spaces" | "collections" | "links", where?: [string, string]) {
  return store
    .getRowIds(table)
    .filter((id) => !where || store.getCell(table, id, where[0]) === where[1])
    .sort((a, b) => (store.getCell(table, a, "order") as number) - (store.getCell(table, b, "order") as number))
}

function nextOrder(table: "spaces" | "collections" | "links", where?: [string, string]) {
  const ids = sortedIds(table, where)
  const last = ids.at(-1)
  return last ? (store.getCell(table, last, "order") as number) + 1 : 1
}

/** Where a link lands: before or after `targetId`, or last when there is none.
    The moving link is left out of the count, so dropping it next to itself is a no-op. */
export type Place = { targetId?: string; after?: boolean }

function linkOrder(collectionId: string, { targetId, after }: Place, moving?: string) {
  const ids = sortedIds("links", ["collectionId", collectionId]).filter((l) => l !== moving)
  const order = (l: string) => store.getCell("links", l, "order") as number
  let i = targetId ? ids.indexOf(targetId) : -1
  if (i >= 0 && after) i++
  if (i < 0 || i >= ids.length) return ids.length ? order(ids.at(-1)!) + 1 : 1
  const at = order(ids[i]!)
  const prev = i > 0 ? order(ids[i - 1]!) : at - 1
  return (prev + at) / 2
}
/* writes */

export function addSpace(name: string, color: Color) {
  const id = uid()
  store.setRow("spaces", id, { name, color, order: nextOrder("spaces") })
  return id
}

export function deleteSpace(id: string) {
  store.transaction(() => {
    for (const c of sortedIds("collections", ["spaceId", id])) deleteCollection(c)
    store.delRow("spaces", id)
  })
}

export function addCollection(spaceId: string, name = "New collection") {
  const id = uid()
  // new collections go to the top, the way people expect a fresh one to appear
  const first = sortedIds("collections", ["spaceId", spaceId])[0]
  const order = first ? (store.getCell("collections", first, "order") as number) - 1 : 1
  store.setRow("collections", id, { spaceId, name, order, collapsed: false, createdAt: Date.now() })
  return id
}

export function deleteCollection(id: string) {
  store.transaction(() => {
    for (const l of sortedIds("links", ["collectionId", id])) store.delRow("links", l)
    store.delRow("collections", id)
  })
}

export type LinkFields = { url: string; title: string; description?: string }

export function addLink(collectionId: string, link: LinkFields, place: Place = {}) {
  const id = uid()
  store.setRow("links", id, {
    collectionId,
    url: link.url,
    title: link.title,
    // the page title, until someone writes something better
    description: link.description ?? link.title,
    order: linkOrder(collectionId, place),
  })
  return id
}

/** Add several links in order at one place, skipping addresses the collection already has. */
export function addLinks(collectionId: string, links: LinkFields[], place: Place = {}) {
  const have = new Set(sortedIds("links", ["collectionId", collectionId]).map((l) => store.getCell("links", l, "url")))
  store.transaction(() => {
    for (const link of links) {
      if (have.has(link.url)) continue
      have.add(link.url)
      // each one lands after the last, so the batch keeps its order
      place = { targetId: addLink(collectionId, link, place), after: true }
    }
  })
}

export function moveLink(id: string, collectionId: string, place: Place = {}) {
  if (id === place.targetId) return
  store.transaction(() => {
    store.setCell("links", id, "order", linkOrder(collectionId, place, id))
    store.setCell("links", id, "collectionId", collectionId)
  })
}
export function saveTabsAsCollection(spaceId: string, name: string, tabs: { url?: string; title?: string }[]) {
  store.transaction(() => {
    const id = addCollection(spaceId, name)
    for (const t of tabs) if (t.url) addLink(id, { url: t.url, title: t.title ?? t.url })
  })
}


/* sorting */

/** A space's collections in the chosen order. `ids` arrive in drag and drop order. */
export function sortCollections(ids: string[], sort: Sort) {
  const cell = (id: string, c: string) => store.getCell("collections", id, c)
  if (sort === "alpha") {
    return [...ids].sort((a, b) => String(cell(a, "name")).localeCompare(String(cell(b, "name")), undefined, { numeric: true }))
  }
  if (sort === "starred") return [...ids].sort((a, b) => Number(!!cell(b, "starred")) - Number(!!cell(a, "starred")))
  if (sort === "created") return [...ids].sort((a, b) => Number(cell(b, "createdAt")) - Number(cell(a, "createdAt")))
  return ids
}

/* tags */

export function collectionTags(id: string): string[] {
  try {
    return JSON.parse((store.getCell("collections", id, "tags") as string) || "[]")
  } catch {
    return []
  }
}

export function toggleTag(collectionId: string, tagId: string) {
  const tags = collectionTags(collectionId)
  const next = tags.includes(tagId) ? tags.filter((t) => t !== tagId) : [...tags, tagId]
  store.setCell("collections", collectionId, "tags", JSON.stringify(next))
}

export function addTag(name: string) {
  const id = uid()
  store.setRow("tags", id, { name, color: COLORS[store.getRowCount("tags") % COLORS.length]! })
  return id
}

export function deleteTag(id: string) {
  store.transaction(() => {
    for (const c of store.getRowIds("collections")) {
      if (collectionTags(c).includes(id)) toggleTag(c, id)
    }
    store.delRow("tags", id)
  })
}

/* moving collections */

/** Put a collection before or after another, in the order the space is shown in.
    Reordering by hand means the order is now the user's, so the sort becomes Drag & Drop. */
export function reorderCollection(id: string, targetId: string, after: boolean) {
  const spaceId = store.getCell("collections", targetId, "spaceId") as string
  const shown = sortCollections(sortedIds("collections", ["spaceId", spaceId]), store.getValue("sort") as Sort)
  const ids = shown.filter((c) => c !== id)
  ids.splice(ids.indexOf(targetId) + (after ? 1 : 0), 0, id)
  store.transaction(() => {
    ids.forEach((c, n) => store.setCell("collections", c, "order", n + 1))
    store.setCell("collections", id, "spaceId", spaceId)
    store.setValue("sort", "manual")
  })
}

/** Move a collection to the top of another space. */
export function moveCollectionToSpace(id: string, spaceId: string) {
  const first = sortedIds("collections", ["spaceId", spaceId])[0]
  store.transaction(() => {
    store.setCell("collections", id, "order", first ? (store.getCell("collections", first, "order") as number) - 1 : 1)
    store.setCell("collections", id, "spaceId", spaceId)
  })
}