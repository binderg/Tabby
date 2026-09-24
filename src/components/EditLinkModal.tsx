import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import { faviconUrl } from "@/lib/favicon"
import { store } from "@/lib/store"

const FIELDS = [
  { key: "title", label: "Title" },
  { key: "description", label: "Description" },
  { key: "url", label: "URL" },
] as const

type Draft = Record<(typeof FIELDS)[number]["key"], string>

export function EditLinkModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => ({
    title: store.getCell("links", id, "title") as string,
    description: store.getCell("links", id, "description") as string,
    url: store.getCell("links", id, "url") as string,
  }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const valid = /^[a-z][a-z0-9+.-]*:/i.test(draft.url.trim())

  const save = () => {
    if (!valid) return
    store.setPartialRow("links", id, {
      title: draft.title.trim(),
      description: draft.description.trim(),
      url: draft.url.trim(),
    })
    onClose()
  }

  /* Portalled so the card's transform cannot trap it. React events still bubble
     through a portal to the card, so pointer downs stop here rather than start a drag. */
  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-scrim p-4"
      onPointerDown={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <form
        onPointerDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-rail p-6 shadow-pop"
      >
        <h2 className="flex items-center gap-2 text-base font-medium">
          <img src={faviconUrl(draft.url)} alt="" className="size-4" />
          Edit card
        </h2>
        {FIELDS.map(({ key, label }, i) => (
          <label key={key} className="flex flex-col gap-1 text-xs text-ink-2">
            {label}
            <input
              autoFocus={i === 0}
              value={draft[key]}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              className="rounded-lg border border-line bg-card px-3 py-2 text-[13px] text-ink outline-accent focus:outline-2"
            />
          </label>
        ))}
        {!valid && <p className="-mt-2 text-xs text-accent">Enter a full URL, like https://example.com</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 hover:bg-hover">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid}
            className="rounded-lg bg-accent px-4 py-1.5 font-medium text-accent-ink hover:brightness-105 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
