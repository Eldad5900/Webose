import React, { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

export default function AppShell({
  userEmail,
  eventsCount,
  meetingsCount,
  eventsBusy,
  onLogout,
  onNewEvent,
  eventMode,
  onToggleEventMode,
  alertsPhone,
  alertsTime,
  alertsNotice,
  hasPendingPhoneAlert,
  notificationsPermission,
  onSaveAlertSettings,
  onSendPendingPhoneAlert,
  themeMode,
  onToggleTheme
}: {
  userEmail?: string | null
  eventsCount: number
  meetingsCount: number
  eventsBusy: boolean
  onLogout: () => void
  onNewEvent: () => void
  eventMode: boolean
  onToggleEventMode: () => void
  alertsPhone: string
  alertsTime: string
  alertsNotice: string
  hasPendingPhoneAlert: boolean
  notificationsPermission: 'granted' | 'denied' | 'default' | 'unsupported'
  onSaveAlertSettings: (phoneInput: string, alertTimeInput: string) => void
  onSendPendingPhoneAlert: () => void
  themeMode: 'light' | 'dark'
  onToggleTheme: () => void
}) {
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false)
  const [phoneDraft, setPhoneDraft] = useState(alertsPhone)
  const [timeDraft, setTimeDraft] = useState(alertsTime)

  useEffect(() => {
    if (!isPhoneModalOpen) return
    setPhoneDraft(alertsPhone)
    setTimeDraft(alertsTime)
  }, [alertsPhone, alertsTime, isPhoneModalOpen])

  const notificationLabel =
    notificationsPermission === 'granted'
      ? 'מאושר'
      : notificationsPermission === 'denied'
        ? 'חסום'
      : notificationsPermission === 'default'
          ? 'ממתין לאישור'
          : 'לא נתמך'

  const handlePhoneSave = (eventInput: React.FormEvent) => {
    eventInput.preventDefault()
    onSaveAlertSettings(phoneDraft, timeDraft)
    setIsPhoneModalOpen(false)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-account">
          <div className="user-chip">{userEmail ?? 'משתמש מחובר'}</div>
          <button className="btn ghost" onClick={onLogout}>
            התנתקות
          </button>
        </div>

        <div className="header-mode">
          <p className="mode-title">מצב אירוע</p>
          <label className="toggle" aria-label="החלפת מצב אירוע">
            <input
              type="checkbox"
              checked={eventMode}
              onChange={onToggleEventMode}
              aria-label="החלפת מצב אירוע"
            />
            <span className="toggle-track" aria-hidden="true">
              <span className="toggle-thumb" />
            </span>
          </label>
          <p className="mode-state">{eventMode ? 'פעיל' : 'כבוי'}</p>
        </div>

        <div className="brand-block">
          <p className="brand-kicker">Wedding Operations Studio</p>
          <h1 className="brand-title">Webose</h1>
          <p className="brand-sub">מערכת ניהול חתונות למפיקים ומנהלי אירועים</p>
        </div>
      </header>

      <div className={`shell-content${eventMode ? ' event-mode-on' : ''}`}>
        <main className="panel main-panel">
          <Outlet />
        </main>

        <aside className="shell-work-card">
          <h3 className="shell-work-title">לוח עבודה</h3>

          <button type="button" className="shell-new-event-btn" onClick={onNewEvent}>
            אירוע חדש
          </button>

          <div className="shell-work-stats">
            <p className="shell-work-label">אירועים פעילים</p>
            <p className="shell-work-value">{eventsCount}</p>
            <p className="shell-work-label">פגישות מתוזמנות</p>
            <p className="shell-work-value">{meetingsCount}</p>
            <p className="shell-work-label">סטטוס מערכת</p>
            <p className="shell-work-value">{eventsBusy ? 'מסנכרן' : 'מוכן'}</p>
          </div>

          <div className="shell-work-links">
            <NavLink to="/events" className={({ isActive }) => `shell-work-link${isActive ? ' active' : ''}`}>
              כל האירועים
            </NavLink>
            <NavLink to="/meetings" className={({ isActive }) => `shell-work-link${isActive ? ' active' : ''}`}>
              ניהול פגישות
            </NavLink>
            <NavLink
              to="/recommended"
              className={({ isActive }) => `shell-work-link${isActive ? ' active' : ''}`}
            >
              ספקים מומלצים
            </NavLink>
          </div>

          <div className="shell-work-alerts">
            <p className="shell-work-label">התראות יומיות</p>
            <p className="shell-work-value">סטטוס דפדפן: {notificationLabel}</p>
            <p className="shell-work-value">
              טלפון התראות למנהל אירוע: {alertsPhone ? alertsPhone : 'לא הוגדר'}
            </p>
            <p className="shell-work-value">שעת התראה יומית: {alertsTime}</p>

            <div className="shell-work-alert-actions">
              <button
                type="button"
                className="shell-work-alert-btn"
                onClick={() => setIsPhoneModalOpen(true)}
              >
                הגדרת טלפון
              </button>
              {hasPendingPhoneAlert ? (
                <button type="button" className="shell-work-alert-btn" onClick={onSendPendingPhoneAlert}>
                  שליחה לטלפון
                </button>
              ) : null}
            </div>

            {alertsNotice ? <p className="helper">{alertsNotice}</p> : null}
          </div>

          <div className="shell-work-theme">
            <p className="shell-work-label">Display Mode</p>
            <div className="shell-work-theme-row">
              <p className="shell-work-value">{themeMode === 'dark' ? 'Dark Mode' : 'Light Mode'}</p>
              <label className="toggle shell-theme-toggle" aria-label="Toggle display mode">
                <input
                  type="checkbox"
                  checked={themeMode === 'dark'}
                  onChange={onToggleTheme}
                  aria-label="Toggle display mode"
                />
                <span className="toggle-track" aria-hidden="true">
                  <span className="toggle-thumb" />
                </span>
              </label>
            </div>
          </div>
        </aside>
      </div>

      {isPhoneModalOpen ? (
        <section className="alerts-phone-modal-backdrop" role="dialog" aria-modal="true">
          <div className="alerts-phone-modal-card">
            <h3 className="section-title">הגדרת התראות יומיות</h3>
            <p className="helper">בחר שעה לקבלת סיכום פגישות ואירועים של כל היום.</p>
            <form className="form" onSubmit={handlePhoneSave}>
              <label className="field">
                טלפון
                <input
                  className="input"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0501234567"
                  value={phoneDraft}
                  onChange={(eventInput) => setPhoneDraft(eventInput.target.value.replace(/\D/g, ''))}
                />
              </label>

              <label className="field">
                שעת התראה יומית
                <input
                  className="input"
                  type="time"
                  value={timeDraft}
                  onChange={(eventInput) => setTimeDraft(eventInput.target.value)}
                  required
                />
              </label>

              <div className="alerts-phone-modal-actions">
                <button type="button" className="btn ghost" onClick={() => setIsPhoneModalOpen(false)}>
                  ביטול
                </button>
                <button type="button" className="btn ghost" onClick={() => setPhoneDraft('')}>
                  ניקוי
                </button>
                <button type="submit" className="btn primary">
                  שמירה
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}
    </div>
  )
}
