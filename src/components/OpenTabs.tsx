import { useEffect, useState } from "react"
import clsx from "clsx"
import { ChevronDown, FolderPlus, PanelRight, X } from "lucide-react"
import { useDraggable } from "@dnd-kit/core"
import { useValue } from "tinybase/ui-react"

import { Tooltip } from "./Tooltip"
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

/** Many tabs dragged as one: a whole window, or a tab group. Drops onto a collection like a single tab. */
function useTabsDrag(id: string, label: string, tabs: chrome.tabs.Tab[]) {
  return useDraggable({
    id,
    data: { type: "tabs", label, tabs: tabs.map((t) => ({ url: t.url!, title: t.title ?? t.url! })) },
  })
}

function WindowSection({ win, label, groups }: { win: Win; label: string; groups: Groups }) {
  const spaceId = useValue("activeSpace") as string
  const [open, setOpen] = useState(true)
  const drag = useTabsDrag(`win:${win.id}`, label, win.tabs)

  // consecutive tabs in the same tab group, kept together in window order
  const runs: { groupId: number; tabs: chrome.tabs.Tab[] }[] = []
  for (const t of win.tabs) {
    const last = runs.at(-1)
    if (last && last.groupId === t.groupId) last.tabs.push(t)
    else runs.push({ groupId: t.groupId, tabs: [t] })
  }

  const stamp = new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

  return (
    <section className={clsx("flex flex-col gap-1.5", drag.isDragging && "opacity-40")}>
      <header
        ref={drag.setNodeRef}
        {...drag.attributes}
        {...drag.listeners}
        className="group/win flex cursor-grab items-center gap-1 rounded-md"
      >
        <button onClick={() => setOpen(!open)} className="flex min-w-0 items-center gap-1 rounded px-1 py-0.5 hover:bg-hover">
          <ChevronDown className={clsx("size-3.5 text-ink-3 transition-transform", !open && "-rotate-90")} />
          <span className="font-medium">{label}</span>
        </button>
        <span className="text-xs text-ink-2">{win.tabs.length} tabs</span>
        <span className="ml-auto" />
        <HeaderButton
          label="Close this window"
          onClick={() => confirm(`Close ${label.toLowerCase()} and its ${win.tabs.length} tabs?`) && chrome.windows.remove(win.id)}
          hover
        >
          <X />
        </HeaderButton>
        <HeaderButton
          label="Save as a new collection"
          onClick={() => saveTabsAsCollection(spaceId, `${label} ${stamp}`, win.tabs)}
        >
          <FolderPlus />
        </HeaderButton>
      </header>
      {open &&
        runs.map((run) => {
          const group = groups.get(run.groupId)
          if (!group) return run.tabs.map((t) => <OpenTab key={t.id} tab={t} />)
          return <TabGroup key={`g${run.groupId}-${run.tabs[0]!.id}`} group={group} tabs={run.tabs} stamp={stamp} />
        })}
    </section>
  )
}

function TabGroup({ group, tabs, stamp }: { group: chrome.tabGroups.TabGroup; tabs: chrome.tabs.Tab[]; stamp: string }) {
  const spaceId = useValue("activeSpace") as string
  const name = group.title || "Unnamed group"
  const drag = useTabsDrag(`group:${group.id}:${tabs[0]!.id}`, name, tabs)
  return (
    <div
      className={clsx("flex flex-col gap-1.5 border-l-[3px] pl-2", drag.isDragging && "opacity-40")}
      style={{ borderColor: GROUP_COLORS[group.color] }}
    >
      <div
        ref={drag.setNodeRef}
        {...drag.attributes}
        {...drag.listeners}
        className="group/win flex cursor-grab items-center gap-1 text-xs font-medium"
        style={{ color: GROUP_COLORS[group.color] }}
      >
        <span className="truncate">{name}</span>
        <span className="text-ink-3">{tabs.length}</span>
        <span className="ml-auto" />
        <HeaderButton
          label="Save group as a new collection"
          onClick={() => saveTabsAsCollection(spaceId, group.title || `Group ${stamp}`, tabs)}
        >
          <FolderPlus />
        </HeaderButton>
      </div>
      {tabs.map((t) => (
        <OpenTab key={t.id} tab={t} />
      ))}
    </div>
  )
}

/** `hover`: only shown while the pointer is over the header. */
function HeaderButton({
  label,
  onClick,
  hover,
  children,
}: {
  label: string
  onClick: () => void
  hover?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        aria-label={label}
        className={clsx(
          "rounded p-1 text-ink-3 hover:bg-hover hover:text-ink [&>svg]:size-3.5",
          hover && "opacity-0 group-hover/win:opacity-100",
        )}
      >
        {children}
      </button>
    </Tooltip>
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
        "group/tab flex cursor-grab items-center gap-2 rounded-lg bg-card py-1.5 pr-1 pl-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
        isDragging && "opacity-40",
      )}
      title={tab.url}
    >
      <img src={faviconUrl(tab.url!)} alt="" className="size-4 shrink-0" />
      <span className="flex-1 truncate text-xs">{tab.title}</span>
      <Tooltip label="Close tab">
        <button
          onClick={(e) => {
            e.stopPropagation()
            chrome.tabs.remove(tab.id!)
          }}
          aria-label="Close tab"
          className="rounded p-0.5 text-ink-3 opacity-0 group-hover/tab:opacity-100 hover:bg-hover hover:text-ink"
        >
          <X className="size-3" />
        </button>
      </Tooltip>
    </div>
  )
}