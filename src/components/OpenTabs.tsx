import { useEffect, useState } from "react"
import clsx from "clsx"
import { ChevronDown, FolderPlus, PanelRight } from "lucide-react"
import { useDraggable } from "@dnd-kit/core"
import { useValue } from "tinybase/ui-react"

import { faviconUrl } from "@/lib/favicon"
import { saveTabsAsCollection } from "@/lib/store"
import { saveable } from "@/lib/tabs"

type Win = { id: number; current: boolean; tabs: chrome.tabs.Tab[] }
type Groups = Map<number, chrome.tabGroups.TabGroup>

const GROUP_COLORS: Record<string, string> = {
  grey: "#8a8f98",
  blue: "#4a86e8",
  red: "#e0524a",
  yellow: "#e8b23a",
  green: "#3fae6a",
  pink: "#e05b9c",
  purple: "#9a5ce0",
  cyan: "#2fb3c9",
  orange: "#ee8b3a",
}

function useAllWindows() {
  const [state, setState] = useState<{ windows: Win[]; groups: Groups }>({ windows: [], groups: new Map() })

  useEffect(() => {
    let live = true
    const refresh = async () => {
      const [all, current, groups] = await Promise.all([
        chrome.windows.getAll({ populate: true, windowTypes: ["normal"] }),
        chrome.windows.getCurrent(),
        // optional: missing on browsers without tab groups, and until the extension
        // is reloaded after the permission was added
        chrome.tabGroups?.query({}) ?? [],
      ])
      if (!live) return
      const windows = all
        .map((w) => ({ id: w.id!, current: w.id === current.id, tabs: (w.tabs ?? []).filter(saveable) }))
        .filter((w) => w.tabs.length > 0)
        .sort((a, b) => Number(b.current) - Number(a.current))
      setState({ windows, groups: new Map(groups.map((g) => [g.id, g])) })
    }
    refresh()

    const events = [
      chrome.tabs.onCreated,
      chrome.tabs.onRemoved,
      chrome.tabs.onUpdated,
      chrome.tabs.onMoved,
      chrome.tabs.onAttached,
      chrome.tabs.onDetached,
      chrome.windows.onCreated,
      chrome.windows.onRemoved,
      chrome.tabGroups?.onUpdated,
      chrome.tabGroups?.onRemoved,
    ].filter(Boolean) as unknown as chrome.events.Event<() => void>[]
    events.forEach((e) => e.addListener(refresh))
    return () => {
      live = false
      events.forEach((e) => e.removeListener(refresh))
    }
  }, [])

  return state
}

export function OpenTabs() {
  const { windows, groups } = useAllWindows()
  const total = windows.reduce((n, w) => n + w.tabs.length, 0)

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-3 py-5 pr-3 pl-4">
      <div className="flex items-center gap-2 text-ink-2">
        <PanelRight className="size-4" />
        <span className="font-medium text-ink">Open Tabs</span>
        <span className="ml-auto text-xs">{total}</span>
      </div>
      <div className="-mr-3 flex flex-col gap-4 overflow-y-auto pr-3">
        {windows.map((w, i) => (
          <WindowSection key={w.id} win={w} label={w.current ? "This window" : `Window ${i + 1}`} groups={groups} />
        ))}
      </div>
      <p className="mt-auto text-xs text-ink-3">Drag a tab onto a collection to save it.</p>
    </aside>
  )
}

function WindowSection({ win, label, groups }: { win: Win; label: string; groups: Groups }) {
  const spaceId = useValue("activeSpace") as string
  const [open, setOpen] = useState(true)

  // consecutive tabs in the same tab group, kept together in window order
  const runs: { groupId: number; tabs: chrome.tabs.Tab[] }[] = []
  for (const t of win.tabs) {
    const last = runs.at(-1)
    if (last && last.groupId === t.groupId) last.tabs.push(t)
    else runs.push({ groupId: t.groupId, tabs: [t] })
  }

  const stamp = new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

  return (
    <section className="flex flex-col gap-1.5">
      <header className="flex items-center gap-1">
        <button onClick={() => setOpen(!open)} className="flex min-w-0 items-center gap-1 rounded px-1 py-0.5 hover:bg-hover">
          <ChevronDown className={clsx("size-3.5 text-ink-3 transition-transform", !open && "-rotate-90")} />
          <span className="font-medium">{label}</span>
        </button>
        <span className="text-xs text-ink-2">{win.tabs.length} tabs</span>
        <SaveButton
          title="Save this window as a collection"
          onClick={() => saveTabsAsCollection(spaceId, `${label} ${stamp}`, win.tabs)}
        />
      </header>
      {open &&
        runs.map((run) => {
          const group = groups.get(run.groupId)
          if (!group) return run.tabs.map((t) => <OpenTab key={t.id} tab={t} />)
          return (
            <div
              key={`g${run.groupId}-${run.tabs[0]!.id}`}
              className="flex flex-col gap-1.5 border-l-[3px] pl-2"
              style={{ borderColor: GROUP_COLORS[group.color] }}
            >
              <div className="flex items-center gap-1 text-xs font-medium" style={{ color: GROUP_COLORS[group.color] }}>
                <span className="truncate">{group.title || "Unnamed group"}</span>
                <span className="text-ink-3">{run.tabs.length}</span>
                <SaveButton
                  title="Save this group as a collection"
                  onClick={() => saveTabsAsCollection(spaceId, group.title || `Group ${stamp}`, run.tabs)}
                />
              </div>
              {run.tabs.map((t) => (
                <OpenTab key={t.id} tab={t} />
              ))}
            </div>
          )
        })}
    </section>
  )
}

function SaveButton({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={title} className="ml-auto rounded p-1 text-ink-3 hover:bg-hover hover:text-ink">
      <FolderPlus className="size-3.5" />
    </button>
  )
}

function OpenTab({ tab }: { tab: chrome.tabs.Tab }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `tab:${tab.id}`,
    data: { type: "tab", url: tab.url, title: tab.title },
  })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => {
        chrome.tabs.update(tab.id!, { active: true })
        chrome.windows.update(tab.windowId, { focused: true })
      }}
      className={clsx(
        "flex cursor-grab items-center gap-2 rounded-lg bg-card px-2.5 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
        isDragging && "opacity-40",
      )}
      title={tab.url}
    >
      <img src={faviconUrl(tab.url!)} alt="" className="size-4 shrink-0" />
      <span className="truncate text-xs">{tab.title}</span>
    </div>
  )
}
