import React from 'react'
import { useParams } from 'react-router-dom'
import type { EventRecord } from '../controlers/types'
import type { SupplierSignaturePayload } from '../types/supplierSigning'
import EventDetailView from '../view/EventDetailView'

export default function EventDetailRoute({
  events,
  onBack,
  onEdit,
  onScheduleMeeting,
  eventMode,
  onSignSupplier
}: {
  events: EventRecord[]
  onBack: () => void
  onEdit: (eventId: string) => void
  onScheduleMeeting: (payload: {
    eventId: string
    coupleName: string
    contactPhone?: number
  }) => void
  eventMode: boolean
  onSignSupplier: (
    eventId: string,
    supplierId: string,
    payload: SupplierSignaturePayload
  ) => Promise<void>
}) {
  const { eventId } = useParams()
  const event = events.find((item) => item.id === eventId)

  if (!event) {
    return <div className="empty">לא נמצא אירוע</div>
  }

  return (
    <EventDetailView
      event={event}
      onBack={onBack}
      onEdit={() => onEdit(event.id)}
      onScheduleMeeting={() =>
        onScheduleMeeting({
          eventId: event.id,
          coupleName: event.coupleName || '',
          contactPhone: event.contactPhone
        })
      }
      eventMode={eventMode}
      onSignSupplier={onSignSupplier}
    />
  )
}
