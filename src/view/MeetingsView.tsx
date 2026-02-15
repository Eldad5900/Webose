import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { MeetingRecord } from '../controlers/types'

const weekdayLabels = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

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

export default function MeetingsView({
  meetings,
  busy,
  error,
  onAdd
}: {
  meetings: MeetingRecord[]
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
  const coupleInputRef = useRef<HTMLInputElement | null>(null)
  const initialPresetAppliedRef = useRef(false)

  const sortedMeetings = useMemo(() => {
    return [...meetings].sort((first, second) => {
      const firstTime = new Date(`${first.date || '1970-01-01'}T${first.time || '00:00'}`).getTime()
      const secondTime = new Date(`${second.date || '1970-01-01'}T${second.time || '00:00'}`).getTime()
      return firstTime - secondTime
    })
  }, [meetings])

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

  const selectedMonthKey = monthKey(viewDate)
  const selectedDayMeetings = meetingsByDate.get(selectedDate) ?? []
  const monthMeetings = sortedMeetings.filter((meeting) => {
    const parsed = parseDateKey(meeting.date)
    return parsed ? monthKey(parsed) === selectedMonthKey : false
  })
  const calendarDays = getCalendarDays(viewDate)
  const nextUpcomingMeeting =
    sortedMeetings.find((meeting) => {
      const value = new Date(`${meeting.date || '1970-01-01'}T${meeting.time || '00:00'}`).getTime()
      return value >= Date.now()
    }) ?? sortedMeetings[0]

  const moveMonth = (diff: number) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + diff, 1))
  }

  useEffect(() => {
    if (initialPresetAppliedRef.current) return
    const presetCoupleName =
      typeof (location.state as { presetCoupleName?: unknown } | null)?.presetCoupleName === 'string'
        ? ((location.state as { presetCoupleName?: string }).presetCoupleName ?? '').trim()
        : ''
    initialPresetAppliedRef.current = true
    if (!presetCoupleName) return
    setForm((prev) => ({ ...prev, coupleName: presetCoupleName }))
    setNotice('נפתחה פגישה חדשה עם שם הזוג מתוך כרטיס האירוע.')
    if (coupleInputRef.current) {
      coupleInputRef.current.focus()
    }
  }, [location.state])

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
    setSaving(true)
    try {
      await onAdd(form)
      setForm((prev) => ({
        ...prev,
        coupleName: '',
        location: '',
        time: '',
        date: selectedDate
      }))
      setNotice(`הפגישה נשמרה ל־${formatPrettyDate(selectedDate)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page meetings-page">
      <section className="hero-block">
        <div>
          <h2 className="page-title">יומן פגישות</h2>
          <p className="helper hero-copy">
            אפשר לבחור תאריך בלחיצה על לוח השנה, לקבוע פגישה, ולראות בנפרד את כל פגישות החודש ואת
            פגישות היום הנבחר.
          </p>
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <p className="stat-label">פגישות בחודש הנוכחי</p>
          <p className="stat-value">{monthMeetings.length}</p>
          <p className="stat-foot">{formatMonthTitle(viewDate)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">פגישות ביום הנבחר</p>
          <p className="stat-value">{selectedDayMeetings.length}</p>
          <p className="stat-foot">{formatPrettyDate(selectedDate)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">הפגישה הקרובה</p>
          <p className="stat-value">{nextUpcomingMeeting?.coupleName || 'לא הוגדר'}</p>
          <p className="stat-foot">
            {nextUpcomingMeeting
              ? formatMeetingDate(nextUpcomingMeeting.date, nextUpcomingMeeting.time)
              : 'אין פגישות'}
          </p>
        </article>
      </section>

      {busy ? <div className="helper">טוען...</div> : null}
      {error ? <div className="error">{error}</div> : null}
      {notice ? <div className="helper notice">{notice}</div> : null}

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
              const count = meetingsByDate.get(day.key)?.length ?? 0
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
                  {count > 0 ? <small>{count}</small> : null}
                </button>
              )
            })}
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
          <h3 className="section-title">כל הפגישות בחודש</h3>
          <div className="meeting-list">
            {monthMeetings.length ? (
              monthMeetings.map((meeting) => (
                <article key={meeting.id} className="meeting-row">
                  <div>
                    <h4>{meeting.coupleName || 'זוג ללא שם'}</h4>
                    <p>{meeting.location || 'מיקום לא הוגדר'}</p>
                  </div>
                  <div className="meeting-time">{formatMeetingDate(meeting.date, meeting.time)}</div>
                </article>
              ))
            ) : (
              <div className="empty-block">
                <h4>אין פגישות בחודש הזה</h4>
                <p>בחר תאריך בלוח השנה וקבע פגישה חדשה.</p>
              </div>
            )}
          </div>
        </section>

        <section className="detail-section">
          <h3 className="section-title">פגישות של היום הנבחר</h3>
          <div className="meeting-list">
            {selectedDayMeetings.length ? (
              selectedDayMeetings.map((meeting) => (
                <article key={meeting.id} className="meeting-row">
                  <div>
                    <h4>{meeting.coupleName || 'זוג ללא שם'}</h4>
                    <p>{meeting.location || 'מיקום לא הוגדר'}</p>
                  </div>
                  <div className="meeting-time">{meeting.time || 'שעה לא הוגדרה'}</div>
                </article>
              ))
            ) : (
              <div className="empty-block">
                <h4>אין פגישות ביום הזה</h4>
                <p>אפשר לבחור תאריך אחר או לקבוע פגישה חדשה.</p>
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
