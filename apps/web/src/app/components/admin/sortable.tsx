/**
 * Drag and drop ordering for admin lists (owner's note, round 6: instead of the up/down arrows).
 * Each row gets a grip handle; a drop calls `onMove(id, index)` and the list shows the new order at
 * once, then follows the server. Keyboard: focus the grip, Space, arrows, Space.
 */
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@crazy-staff/ui'
import { GripVertical } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { m } from '../../paraglide/messages.js'

/** Rows move up and down only. */
const vertical: Modifier = ({ transform }) => ({ ...transform, x: 0 })

export function SortableList<T extends { id: string }>({
  items,
  onMove,
  className,
  children,
}: {
  items: T[]
  onMove: (id: string, to: number) => Promise<unknown> | void
  className?: string
  children: (item: T, handle: ReactNode) => ReactNode
}) {
  const [order, setOrder] = useState(items)
  useEffect(() => setOrder(items), [items])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = order.findIndex((item) => item.id === active.id)
    const to = order.findIndex((item) => item.id === over.id)
    setOrder(arrayMove(order, from, to))
    void onMove(String(active.id), to)
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[vertical]}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={order.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {order.map((item) => (
            <SortableRow key={item.id} id={item.id}>
              {(handle) => children(item, handle)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({ id, children }: { id: string; children: (handle: ReactNode) => ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      aria-label={m.admin_drag()}
      title={m.admin_drag()}
      className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-control-sm text-muted outline-none hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" />
    </button>
  )
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'relative',
        // only the row being dragged gets a surface of its own, rounded inside the card's outline
        isDragging && 'squircle z-10 rounded-control bg-surface opacity-95 shadow-overlay'
      )}
    >
      {children(handle)}
    </div>
  )
}
