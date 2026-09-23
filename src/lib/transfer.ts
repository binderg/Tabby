/* Getting data in and out as a file.
 *
 * Tabby's own export is the MergeableStore content, so importing it merges
 * rather than overwrites. The Toby importer reads Toby's JSON export
 * ({ lists: [{ title, cards: [{ title, url, customTitle, customDescription }] }] })
 * into a new space.
 */
import { addLink, addSpace, addCollection, store } from "./store"

export function exportJson() {
  const blob = new Blob([JSON.stringify({ tabby: 1, content: store.getMergeableContent() })], {
    type: "application/json",
  })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `tabby-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

type TobyCard = { title?: string; url?: string; customTitle?: string; customDescription?: string }
type TobyList = { title?: string; cards?: TobyCard[] }

/** Returns a short description of what was imported. */
export function importJson(text: string): string {
  const data = JSON.parse(text)

  if (data?.tabby && data.content) {
    store.applyMergeableChanges(data.content)
    return "Tabby backup merged"
  }

  const lists: TobyList[] | undefined = data?.lists ?? data?.groups?.flatMap((g: { lists?: TobyList[] }) => g.lists ?? [])
  if (Array.isArray(lists)) {
    let cards = 0
    store.transaction(() => {
      const space = addSpace("From Toby", "amber")
      // addCollection puts each new one first, so walk backwards to keep Toby's order
      for (const list of [...lists].reverse()) {
        const col = addCollection(space, list.title || "Untitled")
        for (const c of list.cards ?? []) {
          if (!c.url) continue
          addLink(col, { url: c.url, title: c.customTitle || c.title || c.url, description: c.customDescription || c.title })
          cards++
        }
      }
      store.setValue("activeSpace", space)
    })
    return `Imported ${lists.length} collections and ${cards} tabs from Toby`
  }

  throw new Error("Not a Tabby or Toby export")
}
