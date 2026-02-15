import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'

export default function AppShell({
  userEmail,
  eventsCount,
  meetingsCount,
  eventsBusy,
  onLogout,
  onNewEvent,
  eventMode,
  onToggleEventMode
}: {
  userEmail?: string | null
  eventsCount: number
  meetingsCount: number
  eventsBusy: boolean
  onLogout: () => void
  onNewEvent: () => void
  eventMode: boolean
  onToggleEventMode: () => void
}) {
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
        </aside>
      </div>
    </div>
  )
}
