import React, { useMemo, useState } from 'react'
import type { EventRecord } from '../controlers/types'

function toDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function formatDate(value: string) {
  const parsed = toDate(value)
  if (!parsed) return value || 'לא נקבע'
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit'
  }).format(parsed)
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase()
}

export default function EventsHome({
  events,
  busy,
  error,
  onSelect,
  eventMode
}: {
  events: EventRecord[]
  busy: boolean
  error: string
  onSelect: (eventId: string) => void
  eventMode: boolean
}) {
  const [query, setQuery] = useState('')

  const sortedEvents = useMemo(() => {
    return [...events].sort((first, second) => {
      const firstDate = toDate(first.date)?.getTime() ?? Number.MAX_SAFE_INTEGER
      const secondDate = toDate(second.date)?.getTime() ?? Number.MAX_SAFE_INTEGER
      return firstDate - secondDate
    })
  }, [events])

  const filteredEvents = useMemo(() => {
    const normalizedQuery = normalizeValue(query)
    if (!normalizedQuery) return sortedEvents

    return sortedEvents.filter((event) => {
      const combined = normalizeValue(
        `${event.coupleName} ${event.hall} ${event.status} ${event.date} ${event.groomName} ${event.brideName}`
      )
      return combined.includes(normalizedQuery)
    })
  }, [query, sortedEvents])

  return (
    <div className={`page${eventMode ? ' event-mode-page' : ''}`}>
      <section className={`ref-events-card${eventMode ? ' event-mode-focus' : ''}`}>
        <div className="ref-events-head">
          <span className="ref-events-kicker">כל האירועים</span>
          <h2 className="page-title">חתונות פעילות בישראל</h2>
        </div>

        <label className="field ref-search-field">
          חיפוש אירוע
          <input
            className="input"
            type="search"
            placeholder="שם זוג, אולם, סטטוס או תאריך"
            value={query}
            onChange={(eventInput) => setQuery(eventInput.target.value)}
          />
        </label>

        {error ? <div className="error">{error}</div> : null}

        <div className="ref-events-list">
          {busy ? (
            <div className="helper">טוען נתונים...</div>
          ) : filteredEvents.length ? (
            filteredEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                className="ref-event-row"
                onClick={() => onSelect(event.id)}
              >
                <span className="ref-event-row-title">{event.coupleName || 'ללא שם זוג'}</span>
                <span className="ref-event-row-meta">
                  {eventMode ? 'תאריך מוסתר' : formatDate(event.date)} ·{' '}
                  {eventMode ? 'אולם מוסתר' : event.hall || 'אולם לא הוגדר'}
                </span>
              </button>
            ))
          ) : (
            <div className="ref-empty">עדיין אין אירועים במערכת.</div>
          )}
        </div>
      </section>
    </div>
  )
}
