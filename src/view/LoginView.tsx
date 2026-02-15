import React, { useState } from 'react'

export default function LoginView({
  onLogin,
  busy,
  error
}: {
  onLogin: (email: string, password: string) => Promise<void>
  busy: boolean
  error: string
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (eventInput: React.FormEvent) => {
    eventInput.preventDefault()
    await onLogin(email, password)
  }

  return (
    <div className="login-shell">
      <div className="panel login-card">
        <section className="login-intro">
          <p className="brand-kicker">מערכת ניהול חתונות</p>
          <h2 className="page-title">כניסה למנהל האירועים</h2>
          <p className="helper">
            מרכז אחד לכל מה שמפיק צריך: לוח אירועים, תזמון פגישות, ספקים ותשלומים ביום אמת.
          </p>
          <div className="login-points">
            <span>ניהול זוגות וסטטוסים</span>
            <span>שליטה בתזמון אירוע</span>
            <span>מעקב חתימות ספקים</span>
          </div>
        </section>
        <form onSubmit={handleSubmit} className="form login-form">
          <label className="field">
            אימייל
            <input
              className="input"
              type="email"
              placeholder="name@email.com"
              value={email}
              onChange={(eventInput) => setEmail(eventInput.target.value)}
              required
            />
          </label>
          <label className="field">
            סיסמה
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(eventInput) => setPassword(eventInput.target.value)}
              required
            />
          </label>
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? 'מתחבר...' : 'כניסה למערכת'}
          </button>
          {error ? <div className="error">{error}</div> : null}
        </form>
      </div>
    </div>
  )
}
