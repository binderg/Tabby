import { useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  closestCenter,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"

import { CardBody } from "./LinkCard"
import { OpenTabs } from "./OpenTabs"
import { Sidebar } from "./Sidebar"
import { SpaceView } from "./SpaceView"
import { addLink, moveLink, store, useStoreReady } from "@/lib/store"

type Dragged = { url: string; title: string; description?: string }

/* Find the collection under the pointer, then the card in it nearest the
   dragged card. Over a collection but not near any card means "append". */
const collision: CollisionDetection = (args) => {
  const col = pointerWithin(args).find((h) => String(h.id).startsWith("col:"))
  if (!col) return []
  const colId = String(col.id).slice(4)
  const cards = args.droppableContainers.filter(
    (c) => c.data.current?.type === "link" && c.data.current.collectionId === colId,
  )
  return cards.length ? closestCenter({ ...args, droppableContainers: cards }) : [col]
}
export function App() {
  const ready = useStoreReady()
  const [query, setQuery] = useState("")
  const [dragged, setDragged] = useState<Dragged | null>(null)
  // a small movement threshold so a click on a card still opens it
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const onDragStart = ({ active }: DragStartEvent) => {
    const d = active.data.current!
    if (d.type === "tab") setDragged({ url: d.url, title: d.title })
    if (d.type === "link") {
      setDragged({
        url: store.getCell("links", d.id, "url") as string,
        title: store.getCell("links", d.id, "title") as string,
        description: store.getCell("links", d.id, "description") as string,
      })
    }
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragged(null)
    if (!over) return
    const from = active.data.current!
    const to = over.data.current!
    if (to.type === "collection") {
      if (from.type === "tab") addLink(to.id, { url: from.url, title: from.title })
      if (from.type === "link") moveLink(from.id, to.id)
      return
    }

    // Dropped on a card. Within one collection, follow the sortable preview:
    // moving forward lands after the card, moving back lands before it. From
    // elsewhere, land on whichever side of the card the pointer is past.
    let after: boolean
    if (from.type === "link" && from.collectionId === to.collectionId) {
      after = from.sortable.index < to.sortable.index
    } else {
      const moved = active.rect.current.translated
      const cx = moved ? moved.left + moved.width / 2 : 0
      const cy = moved ? moved.top + moved.height / 2 : 0
      after = cy > over.rect.bottom || (cy >= over.rect.top && cx > over.rect.left + over.rect.width / 2)
    }
    const place = { targetId: to.id, after }
    if (from.type === "tab") addLink(to.collectionId, { url: from.url, title: from.title }, place)
    if (from.type === "link") moveLink(from.id, to.collectionId, place)
  }
  if (!ready) return null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragged(null)}
    >
      <div className="flex h-full">
        <Sidebar query={query} setQuery={setQuery} />
        <SpaceView query={query} />
        <OpenTabs />
      </div>
      <DragOverlay dropAnimation={null}>
        {dragged && (
          <div className="w-[180px] rotate-2 cursor-grabbing shadow-lg">
            <CardBody {...dragged} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
