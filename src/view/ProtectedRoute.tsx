import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import type { User } from 'firebase/auth'

export default function ProtectedRoute({
  user,
  ready,
  redirectTo
}: {
  user: User | null
  ready: boolean
  redirectTo: string
}) {
  if (!ready) {
    return (
      <div className="loading-shell">
        <div className="panel">
          <div className="helper">טוען נתוני משתמש...</div>
        </div>
      </div>
    )
  }
  if (!user) return <Navigate to={redirectTo} replace />
  return <Outlet />
}
