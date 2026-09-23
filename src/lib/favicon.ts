/** Chrome's own favicon cache (MV3 `favicon` permission), so no request leaves the browser. */
export function faviconUrl(pageUrl: string, size = 32) {
  const u = new URL(chrome.runtime.getURL("/_favicon/"))
  u.searchParams.set("pageUrl", pageUrl)
  u.searchParams.set("size", String(size))
  return u.toString()
}
