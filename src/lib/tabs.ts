/* Acting on the browser's open tabs. */
import { addLink, store } from "./store"

/** Web pages only: no new tab pages, settings, extensions or other browser internals. */
export function saveable(t: chrome.tabs.Tab) {
  return /^(https?|file|ftp):/.test(t.url ?? "")
}

function collectionUrls(collectionId: string) {
  return new Set(
    store
      .getRowIds("links")
      .filter((l) => store.getCell("links", l, "collectionId") === collectionId)
      .map((l) => store.getCell("links", l, "url") as string),
  )
}

/** Close every open tab, in any window, whose address is saved in this collection. */
export async function closeOpenTabsOf(collectionId: string) {
  const urls = collectionUrls(collectionId)
  const tabs = await chrome.tabs.query({})
  const ids = tabs.filter((t) => t.url && urls.has(t.url)).map((t) => t.id!)
  if (ids.length) await chrome.tabs.remove(ids)
  return ids.length
}

/** Add this window's tabs to the end of a collection, skipping ones it already has. */
export async function saveWindowInto(collectionId: string) {
  const urls = collectionUrls(collectionId)
  const tabs = (await chrome.tabs.query({ currentWindow: true })).filter(saveable)
  store.transaction(() => {
    for (const t of tabs) {
      if (urls.has(t.url!)) continue // already saved, or the same page open twice
      urls.add(t.url!)
      addLink(collectionId, { url: t.url!, title: t.title ?? t.url! })
    }
  })
}

/** Show Tabby: switch to a Tabby page that is already open, or open a new one. */
export async function openTabby() {
  const url = chrome.runtime.getURL("/newtab.html")
  const [open] = await chrome.tabs.query({ url })
  if (open?.id) {
    await chrome.tabs.update(open.id, { active: true })
    await chrome.windows.update(open.windowId, { focused: true })
  } else {
    await chrome.tabs.create({ url })
  }
}
