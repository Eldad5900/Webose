import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { EventRecord, MeetingRecord } from '../controlers/types'
import PageHero from '../components/ui/PageHero'
import StatCard from '../components/ui/StatCard'
import StatusMessages from '../components/ui/StatusMessages'

const weekdayLabels = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

type MeetingsLocationState = {
  presetEventId?: string
  presetCoupleName?: string
  presetContactPhone?: string | number | null
}

type AgendaItem = {
  id: string
  type: 'meeting' | 'event'
  title: string
  subtitle: string
  timeLabel: string
  sortValue: number
}

function parseDateKey(dateKey: string) {
  const [yearText, monthText, dayText] = dateKey.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  if (!year || !month || !day) return null
  const parsed = new Date(year, month - 1, day)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatPrettyDate(dateKey: string) {
  const parsed = parseDateKey(dateKey)
  if (!parsed) return dateKey
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(parsed)
}

function formatMeetingDate(date: string, time: string) {
  if (!date) return 'לא נקבע'
  const parsed = parseDateKey(date)
  if (!parsed) return `${date}${time ? ` · ${time}` : ''}`
  const datePart = new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit'
  }).format(parsed)
  return `${datePart}${time ? ` · ${time}` : ''}`
}

function getDateTimeValue(date: string, time?: string) {
  const safeDate = date || '1970-01-01'
  const safeTime = time || '00:00'
  const parsed = new Date(`${safeDate}T${safeTime}`).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function buildEventSubtitle(event: EventRecord) {
  const hall = event.hall?.trim() || 'אולם לא הוגדר'
  const status = event.status?.trim()
  if (!status) return hall
  return `${hall} · סטטוס: ${status}`
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat('he-IL', {
    month: 'long',
    year: 'numeric'
  }).format(date)
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getCalendarDays(viewDate: Date) {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const monthStart = new Date(year, month, 1)
  const startOffset = monthStart.getDay()
  const gridStart = new Date(year, month, 1 - startOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index)
    return {
      date: day,
      key: formatDateKey(day),
      inCurrentMonth: day.getMonth() === month
    }
  })
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

function normalizePhoneDigits(value?: string | number | null) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\D/g, '')
}

function toWhatsAppPhone(phone?: string | number | null) {
  const digits = normalizePhoneDigits(phone)
  if (!digits) return null
  if (digits.startsWith('972')) return digits
  if (digits.startsWith('0')) return `972${digits.slice(1)}`
  if (digits.length >= 8) return `972${digits}`
  return null
}

function buildMeetingMessage({
  coupleName,
  date,
  time,
  location
}: {
  coupleName: string
  date: string
  time: string
  location: string
}) {
  const safeCoupleName = coupleName.trim() || 'זוג יקר'
  const dateLabel = formatPrettyDate(date)
  const timeLabel = time || 'לא צוינה שעה'
  const locationLabel = location.trim() || 'מיקום יימסר בהמשך'

  return [
    `היי ${safeCoupleName},`,
    `נקבעה עבורכם פגישה בתאריך ${dateLabel} בשעה ${timeLabel}.`,
    `מיקום: ${locationLabel}.`,
    'מחכה לראותכם.'
  ].join('\n')
}

export default function MeetingsView({
  meetings,
  events,
  busy,
  error,
  onAdd
}: {
  meetings: MeetingRecord[]
  events: EventRecord[]
  busy: boolean
  error: string
  onAdd: (payload: Omit<MeetingRecord, 'id'>) => Promise<void>
}) {
  const today = new Date()
  const todayKey = formatDateKey(today)
  const location = useLocation()
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [form, setForm] = useState({
    coupleName: '',
    location: '',
    date: todayKey,
    time: ''
  })
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [messageLink, setMessageLink] = useState('')
  const coupleInputRef = useRef<HTMLInputElement | null>(null)
  const initialPresetAppliedRef = useRef(false)

  const sortedMeetings = useMemo(() => {
    return [...meetings].sort((first, second) => {
      const firstTime = getDateTimeValue(first.date, first.time)
      const secondTime = getDateTimeValue(second.date, second.time)
      return firstTime - secondTime
    })
  }, [meetings])

  const sortedEvents = useMemo(() => {
    return [...events].sort((first, second) => {
      const firstTime = getDateTimeValue(first.date, first.arrivalTimeToHall)
      const secondTime = getDateTimeValue(second.date, second.arrivalTimeToHall)
      return firstTime - secondTime
    })
  }, [events])

  const meetingsByDate = useMemo(() => {
    return sortedMeetings.reduce<Map<string, MeetingRecord[]>>((acc, meeting) => {
      const key = meeting.date || ''
      if (!key) return acc
      const existing = acc.get(key) ?? []
      existing.push(meeting)
      acc.set(key, existing)
      return acc
    }, new Map())
  }, [sortedMeetings])

  const eventsByDate = useMemo(() => {
    return sortedEvents.reduce<Map<string, EventRecord[]>>((acc, event) => {
      const key = event.date || ''
      if (!key) return acc
      const existing = acc.get(key) ?? []
      existing.push(event)
      acc.set(key, existing)
      return acc
    }, new Map())
  }, [sortedEvents])

  const selectedMonthKey = monthKey(viewDate)
  const selectedDayMeetings = meetingsByDate.get(selectedDate) ?? []
  const selectedDayEvents = eventsByDate.get(selectedDate) ?? []
  const monthMeetings = sortedMeetings.filter((meeting) => {
    const parsed = parseDateKey(meeting.date)
    return parsed ? monthKey(parsed) === selectedMonthKey : false
  })
  const monthEvents = sortedEvents.filter((event) => {
    const parsed = parseDateKey(event.date)
    return parsed ? monthKey(parsed) === selectedMonthKey : false
  })
  const calendarDays = getCalendarDays(viewDate)

  const monthAgendaItems = useMemo(() => {
    const meetingItems: AgendaItem[] = monthMeetings.map((meeting) => ({
      id: `meeting-${meeting.id}`,
      type: 'meeting',
      title: meeting.coupleName || 'זוג ללא שם',
      subtitle: meeting.location || 'מיקום לא הוגדר',
      timeLabel: formatMeetingDate(meeting.date, meeting.time),
      sortValue: getDateTimeValue(meeting.date, meeting.time)
    }))
    const eventItems: AgendaItem[] = monthEvents.map((event) => ({
      id: `event-${event.id}`,
      type: 'event',
      title: event.coupleName || 'אירוע ללא שם',
      subtitle: buildEventSubtitle(event),
      timeLabel: formatMeetingDate(event.date, event.arrivalTimeToHall || ''),
      sortValue: getDateTimeValue(event.date, event.arrivalTimeToHall)
    }))
    return [...meetingItems, ...eventItems].sort((first, second) => first.sortValue - second.sortValue)
  }, [monthMeetings, monthEvents])

  const selectedDayAgendaItems = useMemo(() => {
    const meetingItems: AgendaItem[] = selectedDayMeetings.map((meeting) => ({
      id: `meeting-day-${meeting.id}`,
      type: 'meeting',
      title: meeting.coupleName || 'זוג ללא שם',
      subtitle: meeting.location || 'מיקום לא הוגדר',
      timeLabel: meeting.time || 'שעה לא הוגדרה',
      sortValue: getDateTimeValue(meeting.date, meeting.time)
    }))
    const eventItems: AgendaItem[] = selectedDayEvents.map((event) => ({
      id: `event-day-${event.id}`,
      type: 'event',
      title: event.coupleName || 'אירוע ללא שם',
      subtitle: buildEventSubtitle(event),
      timeLabel: event.arrivalTimeToHall ? `הגעה ${event.arrivalTimeToHall}` : 'יום אירוע',
      sortValue: getDateTimeValue(event.date, event.arrivalTimeToHall)
    }))
    return [...meetingItems, ...eventItems].sort((first, second) => first.sortValue - second.sortValue)
  }, [selectedDayMeetings, selectedDayEvents])

  const nextUpcomingAgendaItem = useMemo(() => {
    const merged: AgendaItem[] = [
      ...sortedMeetings.map((meeting) => ({
        id: `meeting-next-${meeting.id}`,
        type: 'meeting' as const,
        title: meeting.coupleName || 'זוג ללא שם',
        subtitle: meeting.location || 'מיקום לא הוגדר',
        timeLabel: formatMeetingDate(meeting.date, meeting.time),
        sortValue: getDateTimeValue(meeting.date, meeting.time)
      })),
      ...sortedEvents.map((event) => ({
        id: `event-next-${event.id}`,
        type: 'event' as const,
        title: event.coupleName || 'אירוע ללא שם',
        subtitle: buildEventSubtitle(event),
        timeLabel: formatMeetingDate(event.date, event.arrivalTimeToHall || ''),
        sortValue: getDateTimeValue(event.date, event.arrivalTimeToHall)
      }))
    ].sort((first, second) => first.sortValue - second.sortValue)
    return merged.find((item) => item.sortValue >= Date.now()) ?? merged[0]
  }, [sortedMeetings, sortedEvents])

  const moveMonth = (diff: number) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + diff, 1))
  }

  const routeState = (location.state as MeetingsLocationState | null) ?? null

  const resolveContactPhone = (coupleName: string) => {
    const normalizedCouple = normalizeText(coupleName)
    if (!normalizedCouple) return null

    const presetCoupleName = normalizeText(routeState?.presetCoupleName ?? '')
    if (normalizedCouple === presetCoupleName) {
      const presetEvent = routeState?.presetEventId
        ? events.find((event) => event.id === routeState.presetEventId)
        : undefined
      return presetEvent?.contactPhone ?? routeState?.presetContactPhone ?? null
    }

    const matchedEvent = events.find(
      (event) => normalizeText(event.coupleName || '') === normalizedCouple
    )
    return matchedEvent?.contactPhone ?? null
  }

  useEffect(() => {
    if (initialPresetAppliedRef.current) return
    const presetCoupleName =
      typeof routeState?.presetCoupleName === 'string' ? routeState.presetCoupleName.trim() : ''
    initialPresetAppliedRef.current = true
    if (!presetCoupleName) return

    const prefilledPhone = resolveContactPhone(presetCoupleName)
    setForm((prev) => ({ ...prev, coupleName: presetCoupleName }))
    setNotice(
      prefilledPhone
        ? 'נפתחה פגישה חדשה עם שם הזוג והטלפון המרכזי מתוך כרטיס האירוע.'
        : 'נפתחה פגישה חדשה עם שם הזוג מתוך כרטיס האירוע.'
    )
    if (coupleInputRef.current) {
      coupleInputRef.current.focus()
    }
  }, [routeState, events])

  const handleDateSelect = (dateKey: string) => {
    const parsed = parseDateKey(dateKey)
    if (!parsed) return
    setSelectedDate(dateKey)
    setViewDate(new Date(parsed.getFullYear(), parsed.getMonth(), 1))
    setForm((prev) => ({ ...prev, date: dateKey }))
    if (!prevHasCoupleName(form.coupleName) && coupleInputRef.current) {
      coupleInputRef.current.focus()
    }
  }

  const handleSubmit = async (eventInput: React.FormEvent) => {
    eventInput.preventDefault()
    setNotice('')
    setMessageLink('')
    setSaving(true)
    try {
      const meetingDraft = {
        ...form,
        coupleName: form.coupleName.trim(),
        location: form.location.trim()
      }

      await onAdd(meetingDraft)

      const whatsappPhone = toWhatsAppPhone(resolveContactPhone(meetingDraft.coupleName))
      let nextNotice = `הפגישה נשמרה ל־${formatPrettyDate(selectedDate)}`
      let nextMessageLink = ''

      if (whatsappPhone) {
        const messageText = buildMeetingMessage({
          coupleName: meetingDraft.coupleName,
          date: meetingDraft.date,
          time: meetingDraft.time,
          location: meetingDraft.location
        })
        nextMessageLink = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(messageText)}`
        const popup = window.open(nextMessageLink, '_blank', 'noopener,noreferrer')
        if (popup) {
          nextNotice = 'הפגישה נשמרה ונפתחה הודעה לזוג בוואטסאפ.'
        } else {
          nextNotice = 'הפגישה נשמרה. הדפדפן חסם פתיחה אוטומטית, לחץ על שליחת הודעה לזוג.'
        }
      } else {
        nextNotice = 'הפגישה נשמרה, אבל לא נמצא טלפון קשר מרכזי לזוג לשליחת הודעה.'
      }

      setForm((prev) => ({
        ...prev,
        coupleName: '',
        location: '',
        time: '',
        date: selectedDate
      }))
      setMessageLink(nextMessageLink)
      setNotice(nextNotice)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page meetings-page">
      <PageHero
        title="יומן פגישות"
        description="אפשר לבחור תאריך בלחיצה על לוח השנה, לקבוע פגישה חדשה, ולראות ביומן גם פגישות רגילות וגם אירועי זוג לפי תאריך."
      />

      <section className="stats-grid">
        <StatCard
          label="פריטים בחודש הנוכחי"
          value={monthAgendaItems.length}
          foot={`${formatMonthTitle(viewDate)} · ${monthMeetings.length} פגישות · ${monthEvents.length} אירועים`}
        />
        <StatCard
          label="פריטים ביום הנבחר"
          value={selectedDayAgendaItems.length}
          foot={`${formatPrettyDate(selectedDate)} · ${selectedDayMeetings.length} פגישות · ${selectedDayEvents.length} אירועים`}
        />
        <StatCard
          label="הפריט הקרוב ביומן"
          value={nextUpcomingAgendaItem?.title || 'לא הוגדר'}
          foot={
            nextUpcomingAgendaItem
              ? `${nextUpcomingAgendaItem.type === 'meeting' ? 'פגישה רגילה' : 'אירוע זוג'} · ${nextUpcomingAgendaItem.timeLabel}`
              : 'אין פריטים'
          }
        />
      </section>

      <StatusMessages busy={busy} error={error} notice={notice} />
      {messageLink ? (
        <div className="form-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={() => window.open(messageLink, '_blank', 'noopener,noreferrer')}
          >
            שליחת הודעה לזוג
          </button>
        </div>
      ) : null}

      <div className="calendar-layout">
        <section className="detail-section calendar-panel">
          <div className="calendar-head">
            <div className="calendar-controls">
              <button type="button" className="btn ghost" onClick={() => moveMonth(-1)}>
                חודש קודם
              </button>
              <button type="button" className="btn ghost" onClick={() => moveMonth(1)}>
                חודש הבא
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
                  handleDateSelect(todayKey)
                }}
              >
                היום
              </button>
            </div>
            <h3 className="calendar-title">{formatMonthTitle(viewDate)}</h3>
          </div>

          <div className="calendar-grid">
            {weekdayLabels.map((label) => (
              <div key={label} className="calendar-weekday">
                {label}
              </div>
            ))}
            {calendarDays.map((day) => {
              const meetingsCount = meetingsByDate.get(day.key)?.length ?? 0
              const eventsCount = eventsByDate.get(day.key)?.length ?? 0
              const isSelected = day.key === selectedDate
              const isToday = day.key === todayKey
              return (
                <button
                  key={day.key}
                  type="button"
                  className={`calendar-day${day.inCurrentMonth ? '' : ' muted'}${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`}
                  onClick={() => handleDateSelect(day.key)}
                >
                  <span>{day.date.getDate()}</span>
                  {meetingsCount > 0 || eventsCount > 0 ? (
                    <div className="calendar-day-badges">
                      {meetingsCount > 0 ? <small className="calendar-count meeting">פ {meetingsCount}</small> : null}
                      {eventsCount > 0 ? <small className="calendar-count event">א {eventsCount}</small> : null}
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
          <div className="calendar-legend">
            <span className="calendar-legend-item">
              <small className="calendar-count meeting">פ</small>
              פגישות
            </span>
            <span className="calendar-legend-item">
              <small className="calendar-count event">א</small>
              אירועי זוג
            </span>
          </div>
        </section>

        <section className="detail-section">
          <h3 className="section-title">קביעת פגישה לתאריך נבחר</h3>
          <p className="helper">תאריך שנבחר: {formatPrettyDate(selectedDate)}</p>
          <form onSubmit={handleSubmit} className="form">
            <label className="field">
              שם הזוג
              <input
                ref={coupleInputRef}
                className="input"
                placeholder="נועה ויונתן"
                value={form.coupleName}
                onChange={(eventInput) =>
                  setForm((prev) => ({ ...prev, coupleName: eventInput.target.value }))
                }
                required
              />
            </label>
            <label className="field">
              מיקום הפגישה
              <input
                className="input"
                placeholder="משרד / זום / בית קפה"
                value={form.location}
                onChange={(eventInput) =>
                  setForm((prev) => ({ ...prev, location: eventInput.target.value }))
                }
                required
              />
            </label>
            <div className="editor-grid">
              <label className="field">
                תאריך
                <input
                  className="input"
                  type="date"
                  value={form.date}
                  onChange={(eventInput) => {
                    const nextDate = eventInput.target.value
                    setForm((prev) => ({ ...prev, date: nextDate }))
                    if (nextDate) handleDateSelect(nextDate)
                  }}
                  required
                />
              </label>
              <label className="field">
                שעה
                <input
                  className="input"
                  type="time"
                  value={form.time}
                  onChange={(eventInput) =>
                    setForm((prev) => ({ ...prev, time: eventInput.target.value }))
                  }
                  required
                />
              </label>
            </div>
            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? 'שומר...' : 'שמירת פגישה'}
            </button>
          </form>
        </section>
      </div>

      <div className="calendar-lists">
        <section className="detail-section">
          <h3 className="section-title">כל הפגישות והאירועים בחודש</h3>
          <div className="meeting-list">
            {monthAgendaItems.length ? (
              monthAgendaItems.map((item) => (
                <article key={item.id} className={`meeting-row ${item.type}`}>
                  <div>
                    <div className="meeting-row-head">
                      <span className={`status-chip ${item.type === 'meeting' ? 'status-ready' : 'status-plan'}`}>
                        {item.type === 'meeting' ? 'פגישה רגילה' : 'אירוע זוג'}
                      </span>
                    </div>
                    <h4>{item.title}</h4>
                    <p>{item.subtitle}</p>
                  </div>
                  <div className="meeting-time">{item.timeLabel}</div>
                </article>
              ))
            ) : (
              <div className="empty-block">
                <h4>אין פגישות או אירועים בחודש הזה</h4>
                <p>בחר תאריך בלוח השנה או הוסף אירוע חדש.</p>
              </div>
            )}
          </div>
        </section>

        <section className="detail-section">
          <h3 className="section-title">פגישות ואירועים של היום הנבחר</h3>
          <div className="meeting-list">
            {selectedDayAgendaItems.length ? (
              selectedDayAgendaItems.map((item) => (
                <article key={item.id} className={`meeting-row ${item.type}`}>
                  <div>
                    <div className="meeting-row-head">
                      <span className={`status-chip ${item.type === 'meeting' ? 'status-ready' : 'status-plan'}`}>
                        {item.type === 'meeting' ? 'פגישה רגילה' : 'אירוע זוג'}
                      </span>
                    </div>
                    <h4>{item.title}</h4>
                    <p>{item.subtitle}</p>
                  </div>
                  <div className="meeting-time">{item.timeLabel}</div>
                </article>
              ))
            ) : (
              <div className="empty-block">
                <h4>אין פגישות או אירועים ביום הזה</h4>
                <p>אפשר לבחור תאריך אחר, לקבוע פגישה, או לצפות באירוע שנקבע.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function prevHasCoupleName(value: string) {
  return value.trim().length > 0
}
