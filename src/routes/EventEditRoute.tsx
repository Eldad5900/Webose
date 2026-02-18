import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { EventRecord } from '../controlers/types'
import EventEditorView from '../view/EventEditorView'

export default function EventEditRoute({
  events,
  onSave,
  onDelete,
  mode
}: {
  events: EventRecord[]
  onSave: (payload: Omit<EventRecord, 'id'>, eventId?: string) => Promise<void>
  onDelete: (eventId: string, coupleName: string) => Promise<void> | void
  mode: 'new' | 'edit'
}) {
  const { eventId } = useParams()
  const event = events.find((item) => item.id === eventId)
  const navigate = useNavigate()

  return (
    <EventEditorView
      event={event}
      onCancel={() => {
        if (mode === 'edit' && event?.id) navigate(`/events/${event.id}`)
        else navigate('/events')
      }}
      onSave={(payload) => onSave(payload, event?.id)}
      onDelete={(id, coupleName) => onDelete(id, coupleName)}
    />
  )
}
